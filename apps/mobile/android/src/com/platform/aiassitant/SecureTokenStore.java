package com.platform.aiassitant;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Stores device-scoped LifeHub Bridge tokens as AES-GCM ciphertext. The AES key
 * is generated inside AndroidKeyStore and is never written to app preferences.
 */
final class SecureTokenStore {
    static final String TOKEN_KEY_PREFIX = "lifehub.bridge.token:";

    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "ai-assitant.lifehub.bridge.tokens.v1";
    private static final String PREFERENCES_NAME = "ai-assitant-secure-values";
    private static final String VALUE_PREFIX = "value.";
    private static final String CREATED_AT_PREFIX = "createdAt.";
    private static final String ORIGIN_PREFIX = "origin.";
    private static final String PAYLOAD_VERSION = "v2";
    private static final String CIPHER_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int MAX_TOKEN_LENGTH = 4096;

    private final SharedPreferences preferences;

    SecureTokenStore(Context context) {
        preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    static boolean isAllowedTokenKey(String key) {
        if (key == null || !key.startsWith(TOKEN_KEY_PREFIX)) {
            return false;
        }
        String deviceId = key.substring(TOKEN_KEY_PREFIX.length());
        if (deviceId.isEmpty() || deviceId.length() > 128) {
            return false;
        }
        for (int index = 0; index < deviceId.length(); index += 1) {
            char character = deviceId.charAt(index);
            boolean allowed = character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9'
                    || character == '.'
                    || character == '_'
                    || character == '-';
            if (!allowed) {
                return false;
            }
        }
        return true;
    }

    synchronized boolean put(String key, String token, String bridgeBaseUrl) {
        String bridgeOrigin = normalizeBridgeOrigin(bridgeBaseUrl);
        if (!isAllowedTokenKey(key)
                || !isSafeBearerToken(token)
                || bridgeOrigin == null) {
            return false;
        }
        try {
            SecretKey secretKey = getOrCreateSecretKey();
            Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey);
            cipher.updateAAD(aad(key, bridgeOrigin));
            byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            String payload = PAYLOAD_VERSION
                    + ":" + Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                    + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP);
            String storageId = storageId(key);
            return preferences.edit()
                    .putString(VALUE_PREFIX + storageId, payload)
                    .putString(ORIGIN_PREFIX + storageId, bridgeOrigin)
                    .putLong(CREATED_AT_PREFIX + storageId, System.currentTimeMillis())
                    .commit();
        } catch (GeneralSecurityException error) {
            // Never log the exception here: provider messages can contain aliases or device details.
            return false;
        }
    }

    synchronized String getForOrigin(String key, String requestedOrigin) {
        String normalizedOrigin = normalizeBridgeOrigin(requestedOrigin);
        if (!isAllowedTokenKey(key) || normalizedOrigin == null) {
            return null;
        }
        try {
            String storageId = storageId(key);
            String payload = preferences.getString(VALUE_PREFIX + storageId, null);
            String storedOrigin = preferences.getString(ORIGIN_PREFIX + storageId, null);
            if (payload == null || !normalizedOrigin.equals(storedOrigin)) {
                return null;
            }
            String[] fields = payload.split(":", 3);
            if (fields.length != 3 || !PAYLOAD_VERSION.equals(fields[0])) {
                return null;
            }
            byte[] iv = Base64.decode(fields[1], Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(fields[2], Base64.NO_WRAP);
            SecretKey secretKey = getExistingSecretKey();
            if (secretKey == null) {
                return null;
            }
            Cipher cipher = Cipher.getInstance(CIPHER_TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(aad(key, normalizedOrigin));
            byte[] plaintext = cipher.doFinal(encrypted);
            String token = new String(plaintext, StandardCharsets.UTF_8);
            return isSafeBearerToken(token) ? token : null;
        } catch (GeneralSecurityException | IllegalArgumentException error) {
            // Treat corrupted or invalidated values as unavailable without exposing details.
            return null;
        }
    }

    synchronized boolean contains(String key) {
        if (!isAllowedTokenKey(key)) {
            return false;
        }
        String storageId = storageIdUnchecked(key);
        return preferences.contains(VALUE_PREFIX + storageId)
                && normalizeBridgeOrigin(preferences.getString(ORIGIN_PREFIX + storageId, null)) != null;
    }

    synchronized long createdAt(String key) {
        if (!isAllowedTokenKey(key)) {
            return 0L;
        }
        return preferences.getLong(CREATED_AT_PREFIX + storageIdUnchecked(key), 0L);
    }

    synchronized boolean remove(String key) {
        if (!isAllowedTokenKey(key)) {
            return false;
        }
        String storageId = storageIdUnchecked(key);
        boolean existed = preferences.contains(VALUE_PREFIX + storageId);
        boolean committed = preferences.edit()
                .remove(VALUE_PREFIX + storageId)
                .remove(ORIGIN_PREFIX + storageId)
                .remove(CREATED_AT_PREFIX + storageId)
                .commit();
        return committed && existed;
    }

    synchronized String origin(String key) {
        if (!isAllowedTokenKey(key)) {
            return null;
        }
        return normalizeBridgeOrigin(preferences.getString(
                ORIGIN_PREFIX + storageIdUnchecked(key),
                null
        ));
    }

    static String normalizeBridgeOrigin(String rawValue) {
        if (rawValue == null || rawValue.isEmpty() || !rawValue.equals(rawValue.trim())) {
            return null;
        }
        try {
            URI uri = new URI(rawValue);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
            String host = uri.getHost();
            int port = uri.getPort();
            String path = uri.getPath();
            if (!("http".equals(scheme) || "https".equals(scheme))
                    || host == null
                    || host.isEmpty()
                    || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null
                    || uri.getRawFragment() != null
                    || (path != null && !path.isEmpty() && !"/".equals(path))
                    || (port != -1 && (port < 1 || port > 65535))) {
                return null;
            }
            int effectivePort = port == -1 ? ("https".equals(scheme) ? 443 : 80) : port;
            String normalizedHost = host.toLowerCase(Locale.US);
            if (normalizedHost.indexOf(':') >= 0 && !normalizedHost.startsWith("[")) {
                normalizedHost = "[" + normalizedHost + "]";
            }
            return scheme + "://" + normalizedHost + ":" + effectivePort;
        } catch (URISyntaxException invalid) {
            return null;
        }
    }

    private static boolean isSafeBearerToken(String token) {
        if (token == null || token.isEmpty() || token.length() > MAX_TOKEN_LENGTH) {
            return false;
        }
        for (int index = 0; index < token.length(); index += 1) {
            char character = token.charAt(index);
            if (character <= 0x20 || character >= 0x7f) {
                return false;
            }
        }
        return true;
    }

    private static byte[] aad(String key, String bridgeOrigin) {
        return (key + "\n" + bridgeOrigin).getBytes(StandardCharsets.UTF_8);
    }

    private SecretKey getOrCreateSecretKey() throws GeneralSecurityException {
        SecretKey existing = getExistingSecretKey();
        if (existing != null) {
            return existing;
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private SecretKey getExistingSecretKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        try {
            keyStore.load(null);
        } catch (IOException error) {
            throw new GeneralSecurityException("AndroidKeyStore could not be loaded", error);
        }
        java.security.Key key = keyStore.getKey(KEY_ALIAS, null);
        return key instanceof SecretKey ? (SecretKey) key : null;
    }

    private static String storageId(String key) throws GeneralSecurityException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(key.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(hash, Base64.NO_WRAP | Base64.URL_SAFE);
    }

    private static String storageIdUnchecked(String key) {
        try {
            return storageId(key);
        } catch (GeneralSecurityException impossible) {
            // SHA-256 is mandatory on Android. Keep this path deterministic for static analysis.
            throw new IllegalStateException("SHA-256 is unavailable");
        }
    }
}
