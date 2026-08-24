package com.platform.aiassitant;

import java.util.List;
import java.util.Locale;

/** Pure validation rules for temporary finance files handed to Android's share sheet. */
final class FinanceSharePolicy {
    static final String AUTHORITY = "com.platform.aiassitant.finance-share";
    static final String CACHE_DIRECTORY = "orbit-finance-share";
    static final String CACHE_FILE_PREFIX = "orbit-finance-share-";
    static final String JSON_MIME_TYPE = "application/json";
    static final String CSV_MIME_TYPE = "text/csv";
    static final int MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
    static final int MAX_FILE_NAME_LENGTH = 128;
    static final long CACHE_RETENTION_MILLIS = 24L * 60L * 60L * 1000L;

    private FinanceSharePolicy() {}

    static String normalizeMimeType(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase(Locale.US);
        return JSON_MIME_TYPE.equals(normalized) || CSV_MIME_TYPE.equals(normalized)
                ? normalized
                : null;
    }

    static String extensionForMimeType(String mimeType) {
        String normalized = normalizeMimeType(mimeType);
        if (JSON_MIME_TYPE.equals(normalized)) {
            return ".json";
        }
        if (CSV_MIME_TYPE.equals(normalized)) {
            return ".csv";
        }
        return null;
    }

    static String normalizeFileName(String value, String mimeType) {
        String extension = extensionForMimeType(mimeType);
        if (value == null || extension == null) {
            return null;
        }
        String clean = value.trim();
        if (clean.length() == 0) {
            return null;
        }
        for (int index = 0; index < clean.length(); index += 1) {
            char character = clean.charAt(index);
            int type = Character.getType(character);
            if (Character.isISOControl(character)
                    || type == Character.FORMAT
                    || type == Character.LINE_SEPARATOR
                    || type == Character.PARAGRAPH_SEPARATOR
                    || character == '/'
                    || character == '\\') {
                return null;
            }
        }
        if (!clean.toLowerCase(Locale.US).endsWith(extension)) {
            clean += extension;
        }
        if (clean.length() > MAX_FILE_NAME_LENGTH
                || extension.equalsIgnoreCase(clean)) {
            return null;
        }
        return clean;
    }

    static boolean isValidToken(String value) {
        if (value == null || value.length() != 32) {
            return false;
        }
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (!(character >= '0' && character <= '9'
                    || character >= 'a' && character <= 'f')) {
                return false;
            }
        }
        return true;
    }

    static String managedCacheFileName(String token, String mimeType) {
        String extension = extensionForMimeType(mimeType);
        return isValidToken(token) && extension != null
                ? CACHE_FILE_PREFIX + token + extension
                : null;
    }

    static boolean isManagedCacheFileName(String value) {
        if (value == null || !value.startsWith(CACHE_FILE_PREFIX)) {
            return false;
        }
        String suffix = value.substring(CACHE_FILE_PREFIX.length());
        String extension;
        if (suffix.endsWith(".json")) {
            extension = ".json";
        } else if (suffix.endsWith(".csv")) {
            extension = ".csv";
        } else {
            return false;
        }
        return isValidToken(suffix.substring(0, suffix.length() - extension.length()));
    }

    static boolean hasUnpairedSurrogate(String value) {
        if (value == null) {
            return true;
        }
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (Character.isHighSurrogate(character)) {
                if (index + 1 >= value.length()
                        || !Character.isLowSurrogate(value.charAt(index + 1))) {
                    return true;
                }
                index += 1;
            } else if (Character.isLowSurrogate(character)) {
                return true;
            }
        }
        return false;
    }

    static boolean isAllowedContent(String value, String mimeType) {
        String normalizedMime = normalizeMimeType(mimeType);
        if (normalizedMime == null
                || value == null
                || value.length() == 0
                || hasUnpairedSurrogate(value)
                || !LifeHubBackupDocumentPolicy.isWithinByteLimit(value)) {
            return false;
        }
        if (JSON_MIME_TYPE.equals(normalizedMime)) {
            return LifeHubBackupDocumentPolicy.hasJsonObjectEnvelope(value)
                    && LifeHubBackupDocumentPolicy.isStrictJsonObject(value);
        }
        return value.indexOf('\u0000') < 0;
    }

    static ParsedPath parsePathSegments(List<String> segments) {
        if (segments == null || segments.size() != 2) {
            return null;
        }
        String token = segments.get(0);
        String fileName = segments.get(1);
        if (!isValidToken(token) || fileName == null) {
            return null;
        }
        String mimeType = mimeTypeForFileName(fileName);
        String normalizedName = normalizeFileName(fileName, mimeType);
        String cacheFileName = managedCacheFileName(token, mimeType);
        if (normalizedName == null
                || !normalizedName.equals(fileName)
                || cacheFileName == null) {
            return null;
        }
        return new ParsedPath(token, normalizedName, mimeType, cacheFileName);
    }

    static String mimeTypeForFileName(String value) {
        if (value == null) {
            return null;
        }
        String lower = value.toLowerCase(Locale.US);
        if (lower.endsWith(".json")) {
            return JSON_MIME_TYPE;
        }
        if (lower.endsWith(".csv")) {
            return CSV_MIME_TYPE;
        }
        return null;
    }

    static final class ParsedPath {
        final String token;
        final String fileName;
        final String mimeType;
        final String cacheFileName;

        ParsedPath(String token, String fileName, String mimeType, String cacheFileName) {
            this.token = token;
            this.fileName = fileName;
            this.mimeType = mimeType;
            this.cacheFileName = cacheFileName;
        }
    }
}
