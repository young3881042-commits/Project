package com.platform.aiassitant;

import android.Manifest;
import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.json.JSONArray;
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
    private static final int JSON_FILE_CHOOSER_REQUEST_CODE = 4111;
    private static final String NOTIFICATION_PERMISSION_EVENT =
            "lifehub:native-notification-permission";
    private static final String EXACT_ALARM_PERMISSION_EVENT =
            "lifehub:native-exact-alarm-permission";
    private static final String CARD_IMPORT_RESULT_EVENT =
            "lifehub:native-card-import-result";

    private WebView webView;
    private SharedPreferences preferences;
    private LocalAssetResponder localAssetResponder;
    private volatile String trustedTopLevelOrigin;
    private String pendingNotificationPath;
    private String notificationPermissionRequestId;
    private String notificationPermissionRequestOrigin;
    private String exactAlarmPermissionRequestId;
    private String exactAlarmPermissionRequestOrigin;
    private ValueCallback<Uri[]> pendingWebFileCallback;
    private int pendingWebFileRequestCode;
    private final Object documentPickerLock = new Object();
    private volatile LifeHubBackupDocumentCoordinator backupDocumentCoordinator;
    private volatile FinanceShareCoordinator financeShareCoordinator;
    private volatile TravelApiCoordinator travelApiCoordinator;
    private AiChatExportCoordinator aiChatExportCoordinator;
    private TravelImageExportCoordinator travelImageExportCoordinator;
    private WorkspaceBridge workspaceBridge;
    private TravelImageWorkspace travelImageWorkspace;

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
                        return isTrustedNativeCaller() ? trustedTopLevelOrigin : null;
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
        financeShareCoordinator = new FinanceShareCoordinator(
                this,
                new FinanceShareCoordinator.Host() {
                    @Override
                    public boolean isTrustedOrigin(String expectedOrigin) {
                        return expectedOrigin != null
                                && expectedOrigin.equals(trustedTopLevelOrigin)
                                && isTrustedNativeCaller();
                    }

                    @Override
                    public void onShareUnavailable() {
                        Toast.makeText(
                                MainActivity.this,
                                R.string.finance_share_unavailable,
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
        );

        preferences = getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        travelApiCoordinator = new TravelApiCoordinator(this, preferences, new TravelApiCoordinator.Host() {
            @Override
            public void deliver(final JSONObject detail) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (webView != null && isTrustedNativeCaller() && !isFinishing()) {
                            webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orbit:travel-result',{detail:"
                                    + detail.toString() + "}));", null);
                        }
                    }
                });
            }
        });
        aiChatExportCoordinator = new AiChatExportCoordinator(this, new AiChatExportCoordinator.Host() {
            public boolean trusted() { return webView != null && isTrustedNativeCaller() && !isFinishing(); }
            public void deliver(JSONObject detail) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orbit:chat-export',{detail:" + detail.toString() + "}));", null);
            }
        });
        travelImageExportCoordinator = new TravelImageExportCoordinator(this, new TravelImageExportCoordinator.Host() {
            public boolean trusted() { return webView != null && isTrustedNativeCaller() && !isFinishing(); }
            public void deliver(JSONObject detail) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orbit:travel-image-export',{detail:" + detail.toString() + "}));", null);
            }
        });
        travelImageWorkspace = new TravelImageWorkspace(this, new TravelImageWorkspace.Host() {
            public boolean trusted() { return webView != null && isTrustedNativeCaller() && !isFinishing(); }
            public void deliver(JSONObject detail) { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orbit:travel-image-file',{detail:" + detail.toString() + "}));", null); }
        });
        workspaceBridge = new WorkspaceBridge(this, preferences, new WorkspaceBridge.Host() {
            public boolean trusted() { return webView != null && isTrustedNativeCaller() && !isFinishing(); }
            public void deliver(JSONObject detail) { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('orbit:workspace-result',{detail:" + detail.toString() + "}));", null); }
        });
        clearLegacyCardImportState();
        AppNotificationCoordinator.ensureChannel(getApplicationContext());
        AppNotificationCoordinator.restoreScheduled(getApplicationContext());
        pendingNotificationPath = AppNotificationCoordinator.pathFromIntent(getIntent());
        preferences.edit().remove(LEGACY_MODE_KEY).remove(LEGACY_SERVER_URL_KEY).apply();
        localAssetResponder = new LocalAssetResponder(getAssets());

        webView = new WebView(this);
        webView.getSettings().setUserAgentString(webView.getSettings().getUserAgentString() + " Orbit/0.9.6");
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
                WebResourceResponse image = travelImageWorkspace == null ? null : travelImageWorkspace.respond(request.getUrl());
                if (image != null) return image;
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

    private void dispatchCardImportResult(
            final String expectedOrigin,
            final JSONObject detail
    ) {
        if (webView == null
                || expectedOrigin == null
                || !expectedOrigin.equals(trustedTopLevelOrigin)
                || detail == null) {
            return;
        }
        final String detailJson = detail.toString();
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView == null || !expectedOrigin.equals(trustedTopLevelOrigin)) {
                    return;
                }
                String script = "window.dispatchEvent(new CustomEvent("
                        + JSONObject.quote(CARD_IMPORT_RESULT_EVENT)
                        + ",{detail:"
                        + detailJson
                        + "}));";
                webView.evaluateJavascript(script, null);
            }
        });
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

    private boolean isTrustedNativeCaller() {
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
        if (requestCode == WorkspaceBridge.REQUEST_CODE && workspaceBridge != null) { workspaceBridge.onResult(resultCode, data); return; }
        if (requestCode == TravelImageExportCoordinator.REQUEST_CODE && travelImageExportCoordinator != null) { travelImageExportCoordinator.onResult(resultCode, data); return; }
        if (requestCode == AiChatExportCoordinator.REQUEST_CODE && aiChatExportCoordinator != null) { aiChatExportCoordinator.onResult(resultCode, data); return; }
        if (backupDocumentCoordinator != null
                && backupDocumentCoordinator.handlesActivityResult(requestCode)) {
            backupDocumentCoordinator.handleActivityResult(requestCode, resultCode, data);
            return;
        }
        if (requestCode != JSON_FILE_CHOOSER_REQUEST_CODE && requestCode != AiChatAttachmentPolicy.REQUEST_CODE) {
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
        boolean attachment = requestCode == AiChatAttachmentPolicy.REQUEST_CODE;
        boolean allowed = attachment ? isTrustedNativeCaller() && AiChatAttachmentPolicy.allowedDocument(this, selected)
                : backupDocumentCoordinator != null && backupDocumentCoordinator.isAllowedImportDocument(selected);
        if (!allowed) {
            if (attachment && resultCode == Activity.RESULT_OK) Toast.makeText(this, "PDF·텍스트 문서(최대 5MB)를 선택해주세요.", Toast.LENGTH_LONG).show();
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

    private boolean launchChatAttachmentPicker() {
        Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("*/*");
        picker.putExtra(Intent.EXTRA_MIME_TYPES, AiChatAttachmentPolicy.MIME_TYPES);
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(picker, AiChatAttachmentPolicy.REQUEST_CODE); return true; }
        catch (ActivityNotFoundException | SecurityException unavailable) { return false; }
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
        if (aiChatExportCoordinator != null) aiChatExportCoordinator.destroy();
        if (travelImageExportCoordinator != null) travelImageExportCoordinator.destroy();
        if (workspaceBridge != null) workspaceBridge.destroy();
        if (travelImageWorkspace != null) travelImageWorkspace.destroy();
        if (travelApiCoordinator != null) {
            travelApiCoordinator.destroy();
            travelApiCoordinator = null;
        }
        clearPendingWebFileCallback();
        financeShareCoordinator = null;
        if (backupDocumentCoordinator != null) {
            backupDocumentCoordinator.destroy(isFinishing() && !isChangingConfigurations());
            backupDocumentCoordinator = null;
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
            boolean attachmentRequest = isTrustedNativeCaller()
                    && requestingWebView != null && requestingWebView.getUrl() != null
                    && "/ai".equals(Uri.parse(requestingWebView.getUrl()).getPath())
                    && AiChatAttachmentPolicy.acceptsRequestedTypes(acceptTypes);
            boolean jsonRequest = LifeHubBackupDocumentPolicy.acceptsRequestedTypes(acceptTypes);
            if (requestingWebView != MainActivity.this.webView
                    || !isTrustedPage()
                    || !singleOpenRequest
                    || (!jsonRequest && !attachmentRequest)
                    || captureRequested) {
                filePathCallback.onReceiveValue(null);
                return true;
            }

            boolean backupBusy;
            synchronized (documentPickerLock) {
                backupBusy = backupDocumentCoordinator != null
                        && backupDocumentCoordinator.hasPendingOperation();
                if (!backupBusy) {
                    pendingWebFileCallback = filePathCallback;
                    pendingWebFileRequestCode = attachmentRequest ? AiChatAttachmentPolicy.REQUEST_CODE : JSON_FILE_CHOOSER_REQUEST_CODE;
                }
            }
            if (backupBusy) {
                filePathCallback.onReceiveValue(null);
                return true;
            }
            boolean launched = attachmentRequest ? launchChatAttachmentPicker() : launchJsonFilePicker();
            if (!launched) {
                clearPendingWebFileCallback();
            }
            return true;
        }
    }

    private final class NativeBridge {
        @JavascriptInterface
        public String getAiRuntimeMode() {
            TravelApiCoordinator coordinator = travelApiCoordinator;
            return isTrustedNativeCaller() && coordinator != null ? coordinator.runtimeMode() : "standby";
        }
        @JavascriptInterface
        public void requestTravelImageFile(String requestId, String action, String key, String content, String metadata) {
            if (isTrustedNativeCaller() && travelImageWorkspace != null) travelImageWorkspace.request(requestId, action, key, content, metadata);
        }
        @JavascriptInterface
        public void requestWorkspaceAction(String requestId, String action) {
            if (isTrustedNativeCaller() && workspaceBridge != null) workspaceBridge.request(requestId, action);
        }

        @JavascriptInterface
        public void exportTravelImage(String requestId, String content) {
            if (isTrustedNativeCaller() && travelImageExportCoordinator != null) travelImageExportCoordinator.request(requestId, content);
        }

        @JavascriptInterface
        public void exportAiConversation(String requestId, String content) {
            if (isTrustedNativeCaller() && aiChatExportCoordinator != null) aiChatExportCoordinator.request(requestId, content);
        }
        @JavascriptInterface
        public void requestTravelAction(String requestId, String action, String payload) {
            TravelApiCoordinator coordinator = travelApiCoordinator;
            if (isTrustedNativeCaller() && coordinator != null) {
                if (("chat-cancel".equals(action) || "runtime-legacy".equals(action)) && workspaceBridge != null) workspaceBridge.cancelTools();
                coordinator.request(requestId, action, payload);
            }
        }
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
        public boolean shareFinanceFile(String fileName, String mimeType, String content) {
            String expectedOrigin = trustedTopLevelOrigin;
            FinanceShareCoordinator coordinator = financeShareCoordinator;
            return expectedOrigin != null
                    && isTrustedNativeCaller()
                    && coordinator != null
                    && coordinator.share(expectedOrigin, fileName, mimeType, content);
        }

        @JavascriptInterface
        public String getNotificationCapabilities() {
            if (!isTrustedNativeCaller()) {
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
        public String getCardImportCapabilities() {
            return isTrustedNativeCaller()
                    ? FinanceNotificationAccess.capabilities(MainActivity.this).toString()
                    : null;
        }

        @JavascriptInterface
        public boolean configureCardImport(String owner, String sourcesJson) {
            return isTrustedNativeCaller()
                    && FinanceTransactionQueue.configure(
                            MainActivity.this,
                            owner,
                            sourcesJson
                    );
        }

        @JavascriptInterface
        public boolean openCardNotificationAccessSettings() {
            if (!isTrustedNativeCaller()
                    || !FinanceNotificationAccess.isSupported(MainActivity.this)) {
                return false;
            }
            final String expectedOrigin = trustedTopLevelOrigin;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!expectedOrigin.equals(trustedTopLevelOrigin)) {
                        return;
                    }
                    try {
                        startActivity(
                                FinanceNotificationAccess.listenerSettingsIntent(
                                        MainActivity.this
                                )
                        );
                    } catch (ActivityNotFoundException | SecurityException unavailableDetailPage) {
                        try {
                            startActivity(
                                    FinanceNotificationAccess.generalListenerSettingsIntent()
                            );
                        } catch (ActivityNotFoundException | SecurityException unavailableSettings) {
                            Toast.makeText(
                                    MainActivity.this,
                                    R.string.card_notification_settings_unavailable,
                                    Toast.LENGTH_LONG
                            ).show();
                        }
                    }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean openAppDetailsSettings() {
            if (!isTrustedNativeCaller()) {
                return false;
            }
            final String expectedOrigin = trustedTopLevelOrigin;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!expectedOrigin.equals(trustedTopLevelOrigin)) {
                        return;
                    }
                    try {
                        startActivity(
                                FinanceNotificationAccess.applicationDetailsIntent(
                                        MainActivity.this
                                )
                        );
                    } catch (ActivityNotFoundException | SecurityException unavailableSettings) {
                        Toast.makeText(
                                MainActivity.this,
                                R.string.card_notification_settings_unavailable,
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean requestPendingCardTransactions(
                String requestId,
                String owner,
                String sourcesJson
        ) {
            final String expectedOrigin = trustedTopLevelOrigin;
            if (!isTrustedNativeCaller()
                    || expectedOrigin == null
                    || !FinanceNotificationPolicy.isValidRequestId(requestId)
                    || FinanceNotificationPolicy.selectedSources(sourcesJson) == null) {
                return false;
            }
            List<FinanceNotificationParser.Candidate> pending =
                    FinanceTransactionQueue.peek(
                            MainActivity.this,
                            owner,
                            sourcesJson
                    );
            if (pending == null) {
                return false;
            }
            JSONObject detail = cardImportResultBase(requestId, "peek");
            if (detail == null) {
                return false;
            }
            try {
                detail.put("items", FinanceTransactionQueue.publicItems(pending));
            } catch (JSONException impossible) {
                return false;
            }
            dispatchCardImportResult(expectedOrigin, detail);
            return true;
        }

        @JavascriptInterface
        public boolean resolvePendingCardTransactions(
                String requestId,
                String owner,
                String decisionsJson
        ) {
            final String expectedOrigin = trustedTopLevelOrigin;
            if (!isTrustedNativeCaller()
                    || expectedOrigin == null
                    || !FinanceNotificationPolicy.isValidRequestId(requestId)) {
                return false;
            }
            Set<String> eventIds = FinanceNotificationAccess.resolvedEventIds(
                    decisionsJson
            );
            if (eventIds == null) {
                return false;
            }
            List<String> resolved = FinanceTransactionQueue.resolve(
                    MainActivity.this,
                    owner,
                    eventIds
            );
            if (resolved == null) {
                return false;
            }
            if (resolved.size() != eventIds.size()) {
                return false;
            }
            JSONArray resolvedIds = new JSONArray();
            for (String eventId : resolved) {
                resolvedIds.put(eventId);
            }
            JSONObject detail = cardImportResultBase(requestId, "resolve");
            if (detail == null) {
                return false;
            }
            try {
                detail.put("resolvedEventIds", resolvedIds);
            } catch (JSONException impossible) {
                return false;
            }
            dispatchCardImportResult(expectedOrigin, detail);
            return true;
        }

        private JSONObject cardImportResultBase(String requestId, String operation) {
            JSONObject detail = new JSONObject();
            try {
                detail.put("schemaVersion", 1);
                detail.put("requestId", requestId);
                detail.put("operation", operation);
                detail.put("ok", true);
                detail.put(
                        "access",
                        FinanceNotificationAccess.accessState(MainActivity.this)
                );
                detail.put(
                        "pendingCount",
                        FinanceTransactionQueue.pendingCount(MainActivity.this)
                );
                detail.put("error", JSONObject.NULL);
            } catch (JSONException impossible) {
                return null;
            }
            return detail;
        }

        @JavascriptInterface
        public String getNotificationPermission() {
            return isTrustedNativeCaller()
                    ? AppNotificationCoordinator.permissionState(MainActivity.this)
                    : null;
        }

        @JavascriptInterface
        public String getExactAlarmPermission() {
            return isTrustedNativeCaller()
                    ? AppNotificationCoordinator.exactAlarmPermissionState(MainActivity.this)
                    : null;
        }

        @JavascriptInterface
        public boolean requestNotificationPermission(final String requestId) {
            if (!isTrustedNativeCaller()
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
            if (!isTrustedNativeCaller()
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
            return isTrustedNativeCaller()
                    && AppNotificationCoordinator.replaceScheduled(MainActivity.this, payload);
        }

        @JavascriptInterface
        public boolean showNotification(String id, String title, String body, String path) {
            return isTrustedNativeCaller()
                    && AppNotificationCoordinator.showNow(MainActivity.this, id, title, body, path);
        }

    }

    private final class AppWebViewClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            clearPendingWebFileCallback();
            trustedTopLevelOrigin = null;
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
            WebResourceResponse image = travelImageWorkspace == null ? null : travelImageWorkspace.respond(request.getUrl());
            if (image != null) return image;
            return localAssetResponder.respond(request.getUrl());
        }

        @Override
        @SuppressWarnings("deprecation")
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            WebResourceResponse image = travelImageWorkspace == null ? null : travelImageWorkspace.respond(Uri.parse(url));
            if (image != null) return image;
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
            if ("https://www.openstreetmap.org/copyright".equals(uri.toString()) && isTrustedNativeCaller()) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (android.content.ActivityNotFoundException ignored) { }
                return true;
            }
            if ("https://auth.openai.com/codex/device".equals(uri.toString()) && isTrustedNativeCaller()) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                catch (android.content.ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "브라우저에서 auth.openai.com/codex/device를 열어주세요.", Toast.LENGTH_LONG).show(); }
                return true;
            }
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
