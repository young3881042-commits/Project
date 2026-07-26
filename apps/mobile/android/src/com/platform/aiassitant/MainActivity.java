package com.platform.aiassitant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String PREFERENCES_NAME = "ai-assitant-native";
    private static final String LEGACY_MODE_KEY = "mode";
    private static final String LEGACY_SERVER_URL_KEY = "serverUrl";
    private static final String LEGACY_CARD_IMPORT_PREFERENCES =
            "ai-assitant-card-import-v1";
    private static final String LEGACY_CARD_IMPORT_CLEARED_KEY =
            "legacyCardImportCleared";
    private static final String KEY_EMBEDDED_WEB_BUILD = "embeddedWebBuild";

    private static final String LOCAL_HOST = "appassets.androidplatform.net";
    private static final String LOCAL_ORIGIN = "https://" + LOCAL_HOST;
    private static final String LOCAL_START_URL = LOCAL_ORIGIN + "/app";

    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 4107;
    private static final int IMAGE_FILE_CHOOSER_REQUEST_CODE = 4108;
    private static final int JSON_FILE_CHOOSER_REQUEST_CODE = 4111;
    private static final String NOTIFICATION_PERMISSION_EVENT =
            "lifehub:native-notification-permission";
    private static final String EXACT_ALARM_PERMISSION_EVENT =
            "lifehub:native-exact-alarm-permission";

    private WebView webView;
    private SharedPreferences preferences;
    private LocalAssetResponder localAssetResponder;
    private SecureTokenStore secureTokenStore;
    private BridgeHttpProxy bridgeHttpProxy;
    private volatile String trustedTopLevelOrigin;
    private ConnectivityManager connectivityManager;
    private boolean networkMonitorRegistered;
    private String pendingNotificationPath;
    private String notificationPermissionRequestId;
    private String notificationPermissionRequestOrigin;
    private String exactAlarmPermissionRequestId;
    private String exactAlarmPermissionRequestOrigin;
    private ValueCallback<Uri[]> pendingWebFileCallback;
    private int pendingWebFileRequestCode;
    private final Object documentPickerLock = new Object();
    private volatile LifeHubBackupDocumentCoordinator backupDocumentCoordinator;

    private final BroadcastReceiver networkReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            dispatchNetworkStatus();
        }
    };

    private final ConnectivityManager.NetworkCallback networkCallback =
            new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    dispatchNetworkStatus();
                }

                @Override
                public void onLost(Network network) {
                    dispatchNetworkStatus();
                }

                @Override
                public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                    dispatchNetworkStatus();
                }
            };

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        backupDocumentCoordinator = new LifeHubBackupDocumentCoordinator(
                this,
                new LifeHubBackupDocumentCoordinator.Host() {
                    @Override
                    public String trustedOriginForBackupCall() {
                        return isTrustedBridgeCaller() ? trustedTopLevelOrigin : null;
                    }

                    @Override
                    public boolean isWebFilePickerPending() {
                        return pendingWebFileCallback != null;
                    }

                    @Override
                    public boolean dispatchBackupResult(
                            String expectedOrigin,
                            JSONObject detail
                    ) {
                        return dispatchBackupDocumentResult(expectedOrigin, detail);
                    }
                },
                documentPickerLock,
                originKey(Uri.parse(LOCAL_ORIGIN)),
                savedInstanceState
        );

        preferences = getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        clearLegacyCardImportState();
        AppNotificationCoordinator.ensureChannel(getApplicationContext());
        AppNotificationCoordinator.restoreScheduled(getApplicationContext());
        pendingNotificationPath = AppNotificationCoordinator.pathFromIntent(getIntent());
        preferences.edit().remove(LEGACY_MODE_KEY).remove(LEGACY_SERVER_URL_KEY).apply();
        localAssetResponder = new LocalAssetResponder(getAssets());
        secureTokenStore = new SecureTokenStore(getApplicationContext());
        bridgeHttpProxy = new BridgeHttpProxy(secureTokenStore, new BridgeHttpProxy.EventSink() {
            @Override
            public void dispatch(String eventName, String trustedOrigin, JSONObject detail) {
                dispatchBridgeEvent(eventName, trustedOrigin, detail);
            }
        });
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);

        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        configureWebView(webView);
        refreshEmbeddedWebBuildCache();
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.addJavascriptInterface(new NativeBridge(), "AiAssistantNative");
        configureServiceWorker();

        setContentView(webView);
        loadLocal();
    }

    private void clearLegacyCardImportState() {
        if (preferences.getBoolean(LEGACY_CARD_IMPORT_CLEARED_KEY, false)) {
            return;
        }
        boolean cleared;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            cleared = deleteSharedPreferences(LEGACY_CARD_IMPORT_PREFERENCES);
            if (!cleared) {
                cleared = getSharedPreferences(
                        LEGACY_CARD_IMPORT_PREFERENCES,
                        Context.MODE_PRIVATE
                ).edit().clear().commit();
            }
        } else {
            cleared = getSharedPreferences(
                    LEGACY_CARD_IMPORT_PREFERENCES,
                    Context.MODE_PRIVATE
            ).edit().clear().commit();
        }
        if (cleared) {
            preferences.edit().putBoolean(LEGACY_CARD_IMPORT_CLEARED_KEY, true).apply();
        }
    }

    private void configureSystemBars() {
        getWindow().setStatusBarColor(getColorCompat(R.color.app_primary_dark));
        getWindow().setNavigationBarColor(getColorCompat(R.color.app_surface));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    private int getColorCompat(int resourceId) {
        return getColor(resourceId);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView(WebView target) {
        WebSettings settings = target.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setGeolocationEnabled(false);
        settings.setSaveFormData(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(target, false);
    }

    @TargetApi(Build.VERSION_CODES.N)
    private void configureServiceWorker() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            return;
        }
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return localAssetResponder.respond(request.getUrl());
            }
        });
    }

    private void loadLocal() {
        String path = pendingNotificationPath;
        pendingNotificationPath = null;
        String target = path == null ? LOCAL_START_URL : LOCAL_ORIGIN + path;
        String buildQuery = "?apkBuild=" + EmbeddedWebBuild.ID;
        if (target.contains("?")) {
            buildQuery = "&apkBuild=" + EmbeddedWebBuild.ID;
        }
        webView.loadUrl(target + buildQuery);
    }

    private void refreshEmbeddedWebBuildCache() {
        String previousBuild = preferences.getString(KEY_EMBEDDED_WEB_BUILD, "");
        if (EmbeddedWebBuild.ID.equals(previousBuild)) {
            return;
        }
        webView.clearCache(true);
        preferences.edit().putString(KEY_EMBEDDED_WEB_BUILD, EmbeddedWebBuild.ID).apply();
    }

    @Override
    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    protected void onStart() {
        super.onStart();
        if (!networkMonitorRegistered && connectivityManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                connectivityManager.registerDefaultNetworkCallback(networkCallback);
            } else {
                registerReceiver(
                        networkReceiver,
                        new IntentFilter(ConnectivityManager.CONNECTIVITY_ACTION)
                );
            }
            networkMonitorRegistered = true;
        }
        dispatchNetworkStatus();
    }

    @Override
    protected void onStop() {
        if (networkMonitorRegistered) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && connectivityManager != null) {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } else {
                unregisterReceiver(networkReceiver);
            }
            networkMonitorRegistered = false;
        }
        super.onStop();
    }

    private String currentNetworkStatusJson() {
        Network activeNetwork = connectivityManager == null ? null : connectivityManager.getActiveNetwork();
        NetworkCapabilities capabilities = activeNetwork == null || connectivityManager == null
                ? null
                : connectivityManager.getNetworkCapabilities(activeNetwork);
        boolean connected = capabilities != null;
        String type = "none";
        if (capabilities != null) {
            if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                type = "vpn";
            } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                type = "wifi";
            } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                type = "mobile";
            } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                type = "ethernet";
            } else if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH)) {
                type = "bluetooth";
            } else {
                type = "other";
            }
        }
        JSONObject detail = new JSONObject();
        try {
            detail.put("connected", connected);
            detail.put("type", type);
            return detail.toString();
        } catch (JSONException impossible) {
            return "{\"connected\":false,\"type\":\"unknown\"}";
        }
    }

    private void dispatchNetworkStatus() {
        if (webView == null || !isTrustedPage()) {
            return;
        }
        final String detailJson = currentNetworkStatusJson();
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !isTrustedPage()) {
                    return;
                }
                String script = "window.dispatchEvent(new CustomEvent('lifehub:native-network-status',"
                        + "{detail:" + detailJson + "}));";
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private void dispatchBridgeEvent(
            final String eventName,
            final String expectedOrigin,
            final JSONObject detail
    ) {
        if (webView == null
                || expectedOrigin == null
                || !expectedOrigin.equals(trustedTopLevelOrigin)
                || !(BridgeHttpProxy.RESPONSE_EVENT.equals(eventName)
                || BridgeHttpProxy.STREAM_EVENT.equals(eventName))) {
            return;
        }
        final String eventLiteral = JSONObject.quote(eventName);
        final String detailJson = detail == null ? "{}" : detail.toString();
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !expectedOrigin.equals(trustedTopLevelOrigin)) {
                    return;
                }
                String script = "window.dispatchEvent(new CustomEvent("
                        + eventLiteral
                        + ",{detail:"
                        + detailJson
                        + "}));";
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private boolean dispatchBackupDocumentResult(
            String expectedOrigin,
            JSONObject detail
    ) {
        if (webView == null
                || expectedOrigin == null
                || !expectedOrigin.equals(trustedTopLevelOrigin)
                || detail == null) {
            return false;
        }
        String script = "window.dispatchEvent(new CustomEvent("
                + JSONObject.quote(LifeHubBackupDocumentCoordinator.RESULT_EVENT)
                + ",{detail:"
                + detail.toString()
                + "}));";
        try {
            webView.evaluateJavascript(script, null);
            return true;
        } catch (RuntimeException unavailablePage) {
            return false;
        }
    }

    private void dispatchNotificationPermission(
            final String requestId,
            final String expectedOrigin
    ) {
        if (webView == null
                || !AppNotificationCoordinator.isValidRequestId(requestId)
                || expectedOrigin == null
                || !expectedOrigin.equals(trustedTopLevelOrigin)) {
            return;
        }
        final String detailJson;
        try {
            JSONObject detail = new JSONObject();
            detail.put("requestId", requestId);
            detail.put("permission", AppNotificationCoordinator.permissionState(this));
            detailJson = detail.toString();
        } catch (JSONException impossible) {
            return;
        }
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !expectedOrigin.equals(trustedTopLevelOrigin)) {
                    return;
                }
                String script = "window.dispatchEvent(new CustomEvent("
                        + JSONObject.quote(NOTIFICATION_PERMISSION_EVENT)
                        + ",{detail:"
                        + detailJson
                        + "}));";
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private void dispatchExactAlarmPermission(
            final String requestId,
            final String expectedOrigin
    ) {
        if (webView == null
                || !AppNotificationCoordinator.isValidRequestId(requestId)
                || expectedOrigin == null
                || !expectedOrigin.equals(trustedTopLevelOrigin)) {
            return;
        }
        final String detailJson;
        try {
            JSONObject detail = new JSONObject();
            detail.put("requestId", requestId);
            detail.put(
                    "permission",
                    AppNotificationCoordinator.exactAlarmPermissionState(this)
            );
            detailJson = detail.toString();
        } catch (JSONException impossible) {
            return;
        }
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !expectedOrigin.equals(trustedTopLevelOrigin)) {
                    return;
                }
                String script = "window.dispatchEvent(new CustomEvent("
                        + JSONObject.quote(EXACT_ALARM_PERMISSION_EVENT)
                        + ",{detail:"
                        + detailJson
                        + "}));";
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private boolean isTrustedPage() {
        return trustedTopLevelOrigin != null;
    }

    private boolean isTrustedBridgeCaller() {
        String localOrigin = originKey(Uri.parse(LOCAL_ORIGIN));
        return localOrigin != null && localOrigin.equals(trustedTopLevelOrigin);
    }

    private boolean isAllowedTopLevelUri(Uri uri) {
        String requestedOrigin = originKey(uri);
        String localOrigin = originKey(Uri.parse(LOCAL_ORIGIN));
        return requestedOrigin != null && requestedOrigin.equals(localOrigin);
    }

    private static String originKey(Uri uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            return null;
        }
        String scheme = uri.getScheme().toLowerCase(Locale.US);
        if (!("http".equals(scheme) || "https".equals(scheme))) {
            return null;
        }
        int port = uri.getPort();
        if (port < 0) {
            port = "https".equals(scheme) ? 443 : 80;
        }
        return scheme + "://" + uri.getHost().toLowerCase(Locale.US) + ":" + port;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (backupDocumentCoordinator != null) {
            backupDocumentCoordinator.onHostResumed();
        }
        if (exactAlarmPermissionRequestId != null) {
            String requestId = exactAlarmPermissionRequestId;
            String expectedOrigin = exactAlarmPermissionRequestOrigin;
            exactAlarmPermissionRequestId = null;
            exactAlarmPermissionRequestOrigin = null;
            AppNotificationCoordinator.restoreScheduled(getApplicationContext());
            dispatchExactAlarmPermission(requestId, expectedOrigin);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String path = AppNotificationCoordinator.pathFromIntent(intent);
        if (path == null || webView == null) {
            return;
        }
        pendingNotificationPath = path;
        loadLocal();
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST_CODE) {
            return;
        }
        String requestId = notificationPermissionRequestId;
        String expectedOrigin = notificationPermissionRequestOrigin;
        notificationPermissionRequestId = null;
        notificationPermissionRequestOrigin = null;
        dispatchNotificationPermission(requestId, expectedOrigin);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (backupDocumentCoordinator != null) {
            backupDocumentCoordinator.saveInstanceState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (backupDocumentCoordinator != null
                && backupDocumentCoordinator.handlesActivityResult(requestCode)) {
            backupDocumentCoordinator.handleActivityResult(requestCode, resultCode, data);
            return;
        }
        if (requestCode != IMAGE_FILE_CHOOSER_REQUEST_CODE
                && requestCode != JSON_FILE_CHOOSER_REQUEST_CODE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        ValueCallback<Uri[]> callback;
        synchronized (documentPickerLock) {
            callback = pendingWebFileRequestCode == requestCode
                    ? pendingWebFileCallback
                    : null;
            if (callback != null) {
                pendingWebFileCallback = null;
                pendingWebFileRequestCode = 0;
            }
        }
        if (callback == null) {
            return;
        }
        Uri selected = resultCode == Activity.RESULT_OK ? singleSelectedUri(data) : null;
        boolean allowed = requestCode == IMAGE_FILE_CHOOSER_REQUEST_CODE
                ? isAllowedSelectedImage(selected)
                : backupDocumentCoordinator != null
                && backupDocumentCoordinator.isAllowedImportDocument(selected);
        if (!allowed) {
            callback.onReceiveValue(null);
            return;
        }
        callback.onReceiveValue(new Uri[]{selected});
    }

    private static Uri singleSelectedUri(Intent data) {
        if (data == null) {
            return null;
        }
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            return clipData.getItemCount() == 1 ? clipData.getItemAt(0).getUri() : null;
        }
        return data.getData();
    }

    private boolean isAllowedSelectedImage(Uri uri) {
        if (uri == null || !ContentResolver.SCHEME_CONTENT.equalsIgnoreCase(uri.getScheme())) {
            return false;
        }
        try {
            String mimeType = getContentResolver().getType(uri);
            if (!ImageFileChooserPolicy.isSupportedMimeType(mimeType)) {
                return false;
            }
            if (!ImageFileChooserPolicy.isAllowedFileSize(selectedContentLength(uri))) {
                return false;
            }
            byte[] header = new byte[12];
            int size = 0;
            try (InputStream input = getContentResolver().openInputStream(uri)) {
                if (input == null) {
                    return false;
                }
                while (size < header.length) {
                    int read = input.read(header, size, header.length - size);
                    if (read <= 0) {
                        break;
                    }
                    size += read;
                }
            }
            return ImageFileChooserPolicy.matchesSignature(mimeType, header, size)
                    && hasAllowedImageBounds(uri);
        } catch (IOException | RuntimeException unavailableImage) {
            return false;
        }
    }

    private long selectedContentLength(Uri uri) {
        ContentResolver resolver = getContentResolver();
        try (Cursor cursor = resolver.query(
                uri,
                new String[]{OpenableColumns.SIZE},
                null,
                null,
                null
        )) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                long size = cursor.getLong(0);
                if (size >= 0) {
                    return size;
                }
            }
        } catch (RuntimeException unavailableMetadata) {
            // Some providers do not expose OpenableColumns metadata.
        }
        try (AssetFileDescriptor descriptor = resolver.openAssetFileDescriptor(uri, "r")) {
            return descriptor == null ? -1L : descriptor.getLength();
        } catch (IOException | RuntimeException unavailableDescriptor) {
            return -1L;
        }
    }

    private boolean hasAllowedImageBounds(Uri uri) {
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) {
                return false;
            }
            BitmapFactory.decodeStream(input, null, options);
            return ImageFileChooserPolicy.isAllowedDimensions(
                    options.outWidth,
                    options.outHeight
            );
        } catch (IOException | RuntimeException invalidImage) {
            return false;
        }
    }

    private void clearPendingWebFileCallback() {
        ValueCallback<Uri[]> callback;
        synchronized (documentPickerLock) {
            callback = pendingWebFileCallback;
            pendingWebFileCallback = null;
            pendingWebFileRequestCode = 0;
        }
        if (callback != null) {
            callback.onReceiveValue(null);
        }
    }

    private boolean launchImageFilePicker(String action) {
        if (backupDocumentCoordinator != null
                && backupDocumentCoordinator.hasPendingOperation()) {
            return false;
        }
        Intent picker = new Intent(action);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("image/*");
        picker.putExtra(Intent.EXTRA_MIME_TYPES, ImageFileChooserPolicy.allowedMimeTypes());
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(picker, IMAGE_FILE_CHOOSER_REQUEST_CODE);
            return true;
        } catch (ActivityNotFoundException | SecurityException unavailablePicker) {
            return false;
        }
    }

    private boolean launchJsonFilePicker() {
        if (backupDocumentCoordinator != null
                && backupDocumentCoordinator.hasPendingOperation()) {
            return false;
        }
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType(LifeHubBackupDocumentPolicy.MIME_TYPE);
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(picker, JSON_FILE_CHOOSER_REQUEST_CODE);
            return true;
        } catch (ActivityNotFoundException | SecurityException unavailablePicker) {
            return false;
        }
    }

    @Override
    protected void onDestroy() {
        clearPendingWebFileCallback();
        if (backupDocumentCoordinator != null) {
            backupDocumentCoordinator.destroy(isFinishing() && !isChangingConfigurations());
            backupDocumentCoordinator = null;
        }
        if (bridgeHttpProxy != null) {
            bridgeHttpProxy.shutdown();
            bridgeHttpProxy = null;
        }
        if (webView != null) {
            webView.removeJavascriptInterface("AiAssistantNative");
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class AppWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView requestingWebView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
        ) {
            if (filePathCallback == null) {
                return false;
            }
            clearPendingWebFileCallback();
            boolean singleOpenRequest = fileChooserParams == null
                    || fileChooserParams.getMode() == FileChooserParams.MODE_OPEN;
            boolean captureRequested = fileChooserParams != null
                    && fileChooserParams.isCaptureEnabled();
            String[] acceptTypes = fileChooserParams == null
                    ? null
                    : fileChooserParams.getAcceptTypes();
            boolean imageRequest = ImageFileChooserPolicy.acceptsRequestedTypes(acceptTypes);
            boolean jsonRequest = LifeHubBackupDocumentPolicy.acceptsRequestedTypes(acceptTypes);
            if (requestingWebView != MainActivity.this.webView
                    || !isTrustedPage()
                    || !singleOpenRequest
                    || !(imageRequest || jsonRequest)
                    || (jsonRequest && captureRequested)) {
                filePathCallback.onReceiveValue(null);
                return true;
            }

            int pickerRequestCode = jsonRequest
                    ? JSON_FILE_CHOOSER_REQUEST_CODE
                    : IMAGE_FILE_CHOOSER_REQUEST_CODE;
            boolean backupBusy;
            synchronized (documentPickerLock) {
                backupBusy = backupDocumentCoordinator != null
                        && backupDocumentCoordinator.hasPendingOperation();
                if (!backupBusy) {
                    pendingWebFileCallback = filePathCallback;
                    pendingWebFileRequestCode = pickerRequestCode;
                }
            }
            if (backupBusy) {
                filePathCallback.onReceiveValue(null);
                return true;
            }
            boolean launched = jsonRequest
                    ? launchJsonFilePicker()
                    : launchImageFilePicker(Intent.ACTION_OPEN_DOCUMENT)
                    || launchImageFilePicker(Intent.ACTION_GET_CONTENT);
            if (!launched) {
                clearPendingWebFileCallback();
            }
            return true;
        }
    }

    private final class NativeBridge {
        @JavascriptInterface
        public boolean exportLifeHubBackup(
                String requestId,
                String fileName,
                String json
        ) {
            LifeHubBackupDocumentCoordinator coordinator = backupDocumentCoordinator;
            return coordinator != null
                    && coordinator.exportLifeHubBackup(requestId, fileName, json);
        }

        @JavascriptInterface
        public boolean importLifeHubBackup(String requestId) {
            LifeHubBackupDocumentCoordinator coordinator = backupDocumentCoordinator;
            return coordinator != null && coordinator.importLifeHubBackup(requestId);
        }

        @JavascriptInterface
        public boolean hasSecureValue(String key) {
            return isTrustedBridgeCaller() && secureTokenStore.contains(key);
        }

        @JavascriptInterface
        public boolean removeSecureValue(String key) {
            return isTrustedBridgeCaller() && secureTokenStore.remove(key);
        }

        @JavascriptInterface
        public String getSecureValueMetadata(String key) {
            if (!isTrustedBridgeCaller() || !SecureTokenStore.isAllowedTokenKey(key)) {
                return null;
            }
            JSONObject metadata = new JSONObject();
            try {
                metadata.put("exists", secureTokenStore.contains(key));
                metadata.put("createdAt", secureTokenStore.createdAt(key));
                metadata.put("storage", "android-keystore");
                metadata.put("bridgeOrigin", secureTokenStore.origin(key));
                metadata.put("exportable", false);
                return metadata.toString();
            } catch (JSONException impossible) {
                return null;
            }
        }

        @JavascriptInterface
        public String getBridgeCapabilities() {
            if (!isTrustedBridgeCaller()) {
                return null;
            }
            JSONObject capabilities = new JSONObject();
            try {
                capabilities.put("nativeTransport", true);
                capabilities.put("http", true);
                capabilities.put("https", true);
                capabilities.put("secureTokenStorage", "android-keystore");
                capabilities.put("tokenExport", false);
                capabilities.put("nativeNotifications", true);
                capabilities.put("scheduledNotifications", true);
                return capabilities.toString();
            } catch (JSONException impossible) {
                return null;
            }
        }

        @JavascriptInterface
        public String getNetworkStatus() {
            return isTrustedBridgeCaller() ? currentNetworkStatusJson() : null;
        }

        @JavascriptInterface
        public String getNotificationCapabilities() {
            if (!isTrustedBridgeCaller()) {
                return null;
            }
            JSONObject capabilities = new JSONObject();
            try {
                capabilities.put("nativeNotifications", true);
                capabilities.put("scheduledNotifications", true);
                capabilities.put("backgroundDelivery", true);
                capabilities.put(
                        "exactTiming",
                        "granted".equals(
                                AppNotificationCoordinator.exactAlarmPermissionState(
                                        MainActivity.this
                                )
                        )
                );
                return capabilities.toString();
            } catch (JSONException impossible) {
                return null;
            }
        }

        @JavascriptInterface
        public String getNotificationPermission() {
            return isTrustedBridgeCaller()
                    ? AppNotificationCoordinator.permissionState(MainActivity.this)
                    : null;
        }

        @JavascriptInterface
        public String getExactAlarmPermission() {
            return isTrustedBridgeCaller()
                    ? AppNotificationCoordinator.exactAlarmPermissionState(MainActivity.this)
                    : null;
        }

        @JavascriptInterface
        public boolean requestNotificationPermission(final String requestId) {
            if (!isTrustedBridgeCaller()
                    || !AppNotificationCoordinator.isValidRequestId(requestId)) {
                return false;
            }
            final String expectedOrigin = trustedTopLevelOrigin;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!expectedOrigin.equals(trustedTopLevelOrigin)) {
                        return;
                    }
                    notificationPermissionRequestId = requestId;
                    notificationPermissionRequestOrigin = expectedOrigin;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED) {
                        AppNotificationCoordinator.markPermissionRequested(MainActivity.this);
                        requestPermissions(
                                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                                NOTIFICATION_PERMISSION_REQUEST_CODE
                        );
                        return;
                    }
                    notificationPermissionRequestId = null;
                    notificationPermissionRequestOrigin = null;
                    dispatchNotificationPermission(requestId, expectedOrigin);
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean requestExactAlarmPermission(final String requestId) {
            if (!isTrustedBridgeCaller()
                    || !AppNotificationCoordinator.isValidRequestId(requestId)) {
                return false;
            }
            final String expectedOrigin = trustedTopLevelOrigin;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!expectedOrigin.equals(trustedTopLevelOrigin)) {
                        return;
                    }
                    String state =
                            AppNotificationCoordinator.exactAlarmPermissionState(
                                    MainActivity.this
                            );
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                            || "granted".equals(state)
                            || "unsupported".equals(state)) {
                        dispatchExactAlarmPermission(requestId, expectedOrigin);
                        return;
                    }
                    exactAlarmPermissionRequestId = requestId;
                    exactAlarmPermissionRequestOrigin = expectedOrigin;
                    AppNotificationCoordinator.markExactAlarmPermissionRequested(
                            MainActivity.this
                    );
                    Intent requestIntent = new Intent(
                            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                            Uri.parse("package:" + getPackageName())
                    );
                    try {
                        startActivity(requestIntent);
                    } catch (RuntimeException unavailableSettings) {
                        exactAlarmPermissionRequestId = null;
                        exactAlarmPermissionRequestOrigin = null;
                        dispatchExactAlarmPermission(requestId, expectedOrigin);
                    }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean replaceScheduledNotifications(String payload) {
            return isTrustedBridgeCaller()
                    && AppNotificationCoordinator.replaceScheduled(MainActivity.this, payload);
        }

        @JavascriptInterface
        public boolean showNotification(String id, String title, String body, String path) {
            return isTrustedBridgeCaller()
                    && AppNotificationCoordinator.showNow(MainActivity.this, id, title, body, path);
        }

        @JavascriptInterface
        public boolean bridgeRequest(
                String requestId,
                String url,
                String method,
                String body,
                String tokenKey
        ) {
            String callerOrigin = isTrustedBridgeCaller() ? trustedTopLevelOrigin : null;
            return callerOrigin != null
                    && bridgeHttpProxy != null
                    && bridgeHttpProxy.request(callerOrigin, requestId, url, method, body, tokenKey);
        }

        @JavascriptInterface
        public boolean bridgeStream(
                String requestId,
                String url,
                String tokenKey,
                String lastEventId
        ) {
            String callerOrigin = isTrustedBridgeCaller() ? trustedTopLevelOrigin : null;
            return callerOrigin != null
                    && bridgeHttpProxy != null
                    && bridgeHttpProxy.stream(callerOrigin, requestId, url, tokenKey, lastEventId);
        }

        @JavascriptInterface
        public boolean bridgeCancel(String requestId) {
            String callerOrigin = isTrustedBridgeCaller() ? trustedTopLevelOrigin : null;
            return callerOrigin != null
                    && bridgeHttpProxy != null
                    && bridgeHttpProxy.cancel(callerOrigin, requestId);
        }
    }

    private final class AppWebViewClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            clearPendingWebFileCallback();
            trustedTopLevelOrigin = null;
            if (bridgeHttpProxy != null) {
                bridgeHttpProxy.cancelAll(false);
            }
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            Uri uri = url == null ? null : Uri.parse(url);
            trustedTopLevelOrigin = isAllowedTopLevelUri(uri) ? originKey(uri) : null;
            super.onPageCommitVisible(view, url);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            Uri uri = url == null ? null : Uri.parse(url);
            Uri currentUri = view.getUrl() == null ? null : Uri.parse(view.getUrl());
            String finishedOrigin = originKey(uri);
            String currentOrigin = originKey(currentUri);
            trustedTopLevelOrigin = finishedOrigin != null
                    && finishedOrigin.equals(currentOrigin)
                    && isAllowedTopLevelUri(currentUri)
                    ? currentOrigin
                    : null;
            dispatchNetworkStatus();
            if (backupDocumentCoordinator != null) {
                backupDocumentCoordinator.onTrustedPageReady();
            }
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (request.isForMainFrame() && !isAllowedTopLevelUri(request.getUrl())) {
                trustedTopLevelOrigin = null;
                return LocalAssetResponder.errorResponse(
                        403,
                        "Forbidden",
                        "This origin is not allowed in the ai-assitant WebView"
                );
            }
            return localAssetResponder.respond(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            return localAssetResponder.respond(Uri.parse(url));
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) {
                return false;
            }
            return shouldBlockNavigation(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return shouldBlockNavigation(Uri.parse(url));
        }

        private boolean shouldBlockNavigation(Uri uri) {
            if (isAllowedTopLevelUri(uri)) {
                return false;
            }
            trustedTopLevelOrigin = null;
            Toast.makeText(MainActivity.this, R.string.navigation_blocked, Toast.LENGTH_SHORT).show();
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
            if (!request.isForMainFrame()) return;
            trustedTopLevelOrigin = null;
            Toast.makeText(MainActivity.this, R.string.page_load_failed, Toast.LENGTH_LONG).show();
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            trustedTopLevelOrigin = null;
            if (bridgeHttpProxy != null) {
                bridgeHttpProxy.cancelAll(false);
            }
            handler.cancel();
            Toast.makeText(MainActivity.this, R.string.page_load_failed, Toast.LENGTH_LONG).show();
        }
    }

    private static final class LocalAssetResponder {
        private final AssetManager assets;

        private LocalAssetResponder(AssetManager assets) {
            this.assets = assets;
        }

        private WebResourceResponse respond(Uri uri) {
            if (uri == null
                    || !"https".equalsIgnoreCase(uri.getScheme())
                    || !LOCAL_HOST.equalsIgnoreCase(uri.getHost())) {
                return null;
            }

            String requestPath = uri.getPath();
            String normalizedPath = requestPath == null ? "" : requestPath.replaceFirst("^/+", "");
            if (normalizedPath.contains("..")) {
                return errorResponse(404, "Not Found", "Not found");
            }
            if (normalizedPath.startsWith("api/") || "api".equals(normalizedPath)
                    || normalizedPath.startsWith("ws/") || "ws".equals(normalizedPath)) {
                return errorResponse(503, "Service Unavailable", "{\"error\":\"Server features are unavailable in local mode\"}");
            }

            String assetPath = normalizedPath.isEmpty() || isClientRoute(normalizedPath)
                    ? "www/index.html"
                    : "www/" + normalizedPath;
            try {
                return successResponse(assetPath, assets.open(assetPath, AssetManager.ACCESS_STREAMING));
            } catch (FileNotFoundException missing) {
                if (isClientRoute(normalizedPath)) {
                    try {
                        return successResponse("www/index.html", assets.open("www/index.html", AssetManager.ACCESS_STREAMING));
                    } catch (IOException ignored) {
                        return errorResponse(500, "Internal Server Error", "Embedded app is unavailable");
                    }
                }
                return errorResponse(404, "Not Found", "Not found");
            } catch (IOException error) {
                return errorResponse(500, "Internal Server Error", "Embedded app is unavailable");
            }
        }

        private static boolean isClientRoute(String path) {
            if (path == null || path.isEmpty()) {
                return true;
            }
            String leaf = path.substring(path.lastIndexOf('/') + 1);
            return !leaf.contains(".");
        }

        private static WebResourceResponse successResponse(String assetPath, InputStream input) {
            String mimeType = mimeType(assetPath);
            String encoding = isTextMimeType(mimeType) ? "UTF-8" : null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", LOCAL_ORIGIN);
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Referrer-Policy", "no-referrer");
            if ("text/html".equals(mimeType)) {
                headers.put(
                        "Content-Security-Policy",
                        "default-src 'self'; "
                                + "script-src 'self'; "
                                + "style-src 'self' 'unsafe-inline'; "
                                + "img-src 'self' data: blob: https:; "
                                + "font-src 'self' data:; "
                                + "connect-src 'self' https: wss:; "
                                + "worker-src 'self' blob:; "
                                + "media-src 'self' blob: https:; "
                                + "frame-src 'none'; frame-ancestors 'none'; "
                                + "object-src 'none'; base-uri 'self'; form-action 'self'"
                );
                headers.put("X-Frame-Options", "DENY");
            }
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, input);
        }

        private static WebResourceResponse errorResponse(int status, String reason, String body) {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            Map<String, String> headers = Collections.singletonMap("Cache-Control", "no-store");
            String mimeType = body.startsWith("{") ? "application/json" : "text/plain";
            return new WebResourceResponse(
                    mimeType,
                    "UTF-8",
                    status,
                    reason,
                    headers,
                    new ByteArrayInputStream(bytes)
            );
        }

        private static boolean isTextMimeType(String mimeType) {
            return mimeType.startsWith("text/")
                    || mimeType.contains("javascript")
                    || mimeType.contains("json")
                    || mimeType.contains("manifest")
                    || mimeType.contains("svg");
        }

        private static String mimeType(String assetPath) {
            String lower = assetPath.toLowerCase(Locale.US);
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".webmanifest")) return "application/manifest+json";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".gif")) return "image/gif";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".ico")) return "image/x-icon";
            if (lower.endsWith(".woff")) return "font/woff";
            if (lower.endsWith(".woff2")) return "font/woff2";
            if (lower.endsWith(".ttf")) return "font/ttf";
            return "application/octet-stream";
        }
    }
}
