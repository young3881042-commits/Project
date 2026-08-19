package com.platform.aiassitant;

import android.app.ActivityManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;

final class FinanceNotificationAccess {
    static final String ACCESS_ENABLED = "enabled";
    static final String ACCESS_DISABLED = "disabled";
    static final String ACCESS_UNSUPPORTED = "unsupported";

    private FinanceNotificationAccess() {}

    static boolean isSupported(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return false;
        }
        try {
            ActivityManager manager = (ActivityManager) context.getSystemService(
                    Context.ACTIVITY_SERVICE
            );
            return manager == null
                    || Build.VERSION.SDK_INT > Build.VERSION_CODES.Q
                    || !manager.isLowRamDevice();
        } catch (RuntimeException unavailableDeviceState) {
            return false;
        }
    }

    static String accessState(Context context) {
        if (!isSupported(context)) {
            return ACCESS_UNSUPPORTED;
        }
        try {
            ComponentName component = listenerComponent(context);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                NotificationManager manager = (NotificationManager) context.getSystemService(
                        Context.NOTIFICATION_SERVICE
                );
                return manager != null
                        && manager.isNotificationListenerAccessGranted(component)
                        ? ACCESS_ENABLED
                        : ACCESS_DISABLED;
            }
            String enabled = Settings.Secure.getString(
                    context.getContentResolver(),
                    "enabled_notification_listeners"
            );
            if (enabled != null) {
                for (String flattened : enabled.split(":")) {
                    ComponentName listed = ComponentName.unflattenFromString(flattened);
                    if (component.equals(listed)) {
                        return ACCESS_ENABLED;
                    }
                }
            }
        } catch (RuntimeException unavailableSettings) {
            return ACCESS_DISABLED;
        }
        return ACCESS_DISABLED;
    }

    static JSONObject capabilities(Context context) {
        JSONObject result = new JSONObject();
        JSONArray sources = new JSONArray();
        JSONArray supportedSourceIds = new JSONArray();
        JSONArray selected = new JSONArray();
        try {
            JSONObject samsungWallet = new JSONObject();
            samsungWallet.put("id", FinanceNotificationParser.SAMSUNG_WALLET_SOURCE);
            samsungWallet.put("label", "삼성월렛");
            sources.put(samsungWallet);
            supportedSourceIds.put(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE);
            if (FinanceTransactionQueue.isCollectionEnabled(context)) {
                selected.put(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE);
            }
            result.put("schemaVersion", 1);
            result.put("nativeCardImport", true);
            result.put("supported", isSupported(context));
            result.put("access", accessState(context));
            result.put("supportedSources", supportedSourceIds);
            result.put("availableSources", sources);
            result.put("selectedSources", selected);
            result.put("pendingCount", FinanceTransactionQueue.pendingCount(context));
        } catch (JSONException impossible) {
            return new JSONObject();
        }
        return result;
    }

    static Intent listenerSettingsIntent(Context context) {
        ComponentName component = listenerComponent(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            return new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                    .putExtra(
                            Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                            component.flattenToString()
                    );
        }
        return new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
    }

    static Intent generalListenerSettingsIntent() {
        return new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
    }

    static Intent applicationDetailsIntent(Context context) {
        return new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.getPackageName())
        );
    }

    static Set<String> resolvedEventIds(String decisionsJson) {
        if (decisionsJson == null || decisionsJson.length() > 32 * 1024) {
            return null;
        }
        LinkedHashSet<String> eventIds = new LinkedHashSet<>();
        try {
            JSONArray decisions = new JSONArray(decisionsJson);
            if (decisions.length() > FinanceNotificationPolicy.MAX_BRIDGE_BATCH) {
                return null;
            }
            for (int index = 0; index < decisions.length(); index += 1) {
                JSONObject decision = decisions.optJSONObject(index);
                if (decision == null || !hasExactDecisionKeys(decision)) {
                    return null;
                }
                String eventId = decision.optString("eventId", "");
                String status = decision.optString("status", "");
                if (!FinanceNotificationPolicy.isValidEventId(eventId)
                        || !FinanceNotificationPolicy.isValidDecisionStatus(status)
                        || !eventIds.add(eventId)) {
                    return null;
                }
            }
            return eventIds;
        } catch (JSONException invalidJson) {
            return null;
        }
    }

    private static boolean hasExactDecisionKeys(JSONObject value) {
        int count = 0;
        Iterator<String> keys = value.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            if (!("eventId".equals(key) || "status".equals(key))) {
                return false;
            }
            count += 1;
        }
        return count == 2 && value.has("eventId") && value.has("status");
    }

    private static ComponentName listenerComponent(Context context) {
        return new ComponentName(context, FinanceNotificationListenerService.class);
    }
}
