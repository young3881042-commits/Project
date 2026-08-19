package com.platform.aiassitant;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class AppNotificationCoordinator {
    static final String ACTION_DELIVER_SCHEDULED =
            "com.platform.aiassitant.action.DELIVER_SCHEDULED_NOTIFICATION";
    static final String ACTION_OPEN_NOTIFICATION =
            "com.platform.aiassitant.action.OPEN_NOTIFICATION";
    static final String EXTRA_PATH = "notificationPath";

    private static final String PREFERENCES_NAME = "ai-assitant-notifications";
    private static final String KEY_PERMISSION_REQUESTED = "permissionRequested";
    private static final String KEY_EXACT_ALARM_PERMISSION_REQUESTED =
            "exactAlarmPermissionRequested";
    private static final String KEY_SCHEDULED = "scheduledNotifications";
    private static final String CHANNEL_ID = "ai-assitant-reminders-v1";
    private static final int SCHEDULE_ALARM_REQUEST_CODE = 7301;
    private static final int MAX_SCHEDULED_NOTIFICATIONS = 128;
    private static final int MAX_PAYLOAD_BYTES = 64 * 1024;
    private static final long MAX_SCHEDULE_HORIZON_MS = 14L * 24L * 60L * 60L * 1000L;
    private static final long MAX_LATE_DELIVERY_MS = 6L * 60L * 60L * 1000L;

    private AppNotificationCoordinator() {}

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = notificationManager(context);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(context.getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    static String permissionState(Context context) {
        NotificationManager manager = notificationManager(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            boolean requested = preferences(context).getBoolean(KEY_PERMISSION_REQUESTED, false);
            return requested ? "denied" : "default";
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N
                && manager != null
                && !manager.areNotificationsEnabled()) {
            return "denied";
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) {
                return "denied";
            }
        }
        return "granted";
    }

    static void markPermissionRequested(Context context) {
        preferences(context).edit().putBoolean(KEY_PERMISSION_REQUESTED, true).apply();
    }

    static String exactAlarmPermissionState(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return "granted";
        }
        AlarmManager manager = alarmManager(context);
        if (manager == null) {
            return "unsupported";
        }
        if (manager.canScheduleExactAlarms()) {
            return "granted";
        }
        boolean requested = preferences(context)
                .getBoolean(KEY_EXACT_ALARM_PERMISSION_REQUESTED, false);
        return requested ? "denied" : "default";
    }

    static void markExactAlarmPermissionRequested(Context context) {
        preferences(context).edit()
                .putBoolean(KEY_EXACT_ALARM_PERMISSION_REQUESTED, true)
                .apply();
    }

    static synchronized boolean replaceScheduled(Context context, String payload) {
        List<ScheduledNotification> notifications = parseReplacementPayload(payload, System.currentTimeMillis());
        if (notifications == null) {
            return false;
        }
        if (!saveScheduled(context, notifications)) {
            return false;
        }
        cancelScheduledAlarm(context);
        scheduleNext(context, notifications, System.currentTimeMillis());
        return true;
    }

    static synchronized void restoreScheduled(Context context) {
        long now = System.currentTimeMillis();
        List<ScheduledNotification> stored = readStored(context);
        List<ScheduledNotification> future = new ArrayList<>();
        for (ScheduledNotification notification : stored) {
            if (notification.triggerAt > now
                    && notification.triggerAt <= now + MAX_SCHEDULE_HORIZON_MS) {
                future.add(notification);
            } else if (notification.triggerAt >= now - MAX_LATE_DELIVERY_MS
                    && notification.triggerAt <= now) {
                postNotification(
                        context,
                        notification.id,
                        notification.title,
                        notification.body,
                        notification.path,
                        notification.triggerAt
                );
            }
        }
        saveScheduled(context, future);
        cancelScheduledAlarm(context);
        scheduleNext(context, future, now);
    }

    static synchronized void deliverScheduled(Context context) {
        long now = System.currentTimeMillis();
        List<ScheduledNotification> stored = readStored(context);
        List<ScheduledNotification> future = new ArrayList<>();
        for (ScheduledNotification notification : stored) {
            if (notification.triggerAt > now) {
                future.add(notification);
            } else if (notification.triggerAt >= now - MAX_LATE_DELIVERY_MS) {
                postNotification(
                        context,
                        notification.id,
                        notification.title,
                        notification.body,
                        notification.path,
                        notification.triggerAt
                );
            }
        }
        saveScheduled(context, future);
        scheduleNext(context, future, now);
    }

    static boolean showNow(Context context, String id, String title, String body, String path) {
        String cleanTitle = validatedText(title, 100, true);
        String cleanBody = validatedText(body, 240, false);
        if (!"granted".equals(permissionState(context))
                || !isValidNotificationId(id)
                || cleanTitle == null
                || cleanBody == null
                || !isAllowedInternalPath(path)) {
            return false;
        }
        return postNotification(context, id, cleanTitle, cleanBody, path, System.currentTimeMillis());
    }

    static String pathFromIntent(Intent intent) {
        if (intent == null || !ACTION_OPEN_NOTIFICATION.equals(intent.getAction())) {
            return null;
        }
        String path = intent.getStringExtra(EXTRA_PATH);
        return isAllowedInternalPath(path) ? path : null;
    }

    static boolean isValidRequestId(String value) {
        if (value == null || value.length() < 1 || value.length() > 128) {
            return false;
        }
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            boolean allowed = character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9'
                    || character == '.'
                    || character == '_'
                    || character == '-'
                    || character == ':';
            if (!allowed) {
                return false;
            }
        }
        return true;
    }

    static boolean isValidNotificationId(String value) {
        if (value == null || value.length() < 1 || value.length() > 180) {
            return false;
        }
        for (int index = 0; index < value.length(); index += 1) {
            if (Character.isISOControl(value.charAt(index))) {
                return false;
            }
        }
        return value.trim().length() > 0;
    }

    static boolean isAllowedInternalPath(String value) {
        if (value == null
                || value.length() < 1
                || value.length() > 512
                || !value.startsWith("/")
                || value.startsWith("//")
                || value.indexOf('\\') >= 0
                || value.indexOf('#') >= 0
                || value.contains("://")
                || value.contains("..")) {
            return false;
        }
        for (int index = 0; index < value.length(); index += 1) {
            if (Character.isISOControl(value.charAt(index))) {
                return false;
            }
        }
        int queryIndex = value.indexOf('?');
        String route = queryIndex >= 0 ? value.substring(0, queryIndex) : value;
        return "/app".equals(route)
                || "/schedule".equals(route);
    }

    private static List<ScheduledNotification> parseReplacementPayload(String payload, long now) {
        if (payload == null || payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_PAYLOAD_BYTES) {
            return null;
        }
        try {
            JSONArray source = new JSONArray(payload);
            if (source.length() > MAX_SCHEDULED_NOTIFICATIONS) {
                return null;
            }
            List<ScheduledNotification> result = new ArrayList<>();
            Set<String> ids = new HashSet<>();
            for (int index = 0; index < source.length(); index += 1) {
                JSONObject row = source.optJSONObject(index);
                if (row == null) {
                    return null;
                }
                ScheduledNotification notification = validatedNotification(row);
                if (notification == null
                        || notification.triggerAt > now + MAX_SCHEDULE_HORIZON_MS
                        || !ids.add(notification.id)) {
                    return null;
                }
                if (notification.triggerAt > now) {
                    result.add(notification);
                }
            }
            return result;
        } catch (JSONException invalidJson) {
            return null;
        }
    }

    private static ScheduledNotification validatedNotification(JSONObject row) {
        String id = row.optString("id", null);
        String title = validatedText(row.optString("title", null), 100, true);
        String body = validatedText(row.optString("body", ""), 240, false);
        String path = row.optString("path", null);
        long triggerAt = row.optLong("triggerAt", 0L);
        if (!isValidNotificationId(id)
                || title == null
                || body == null
                || !isAllowedInternalPath(path)
                || triggerAt <= 0L) {
            return null;
        }
        return new ScheduledNotification(id, title, body, path, triggerAt);
    }

    private static String validatedText(String value, int maximumLength, boolean required) {
        if (value == null) {
            return required ? null : "";
        }
        String clean = value.trim();
        if ((required && clean.length() == 0) || clean.length() > maximumLength) {
            return null;
        }
        for (int index = 0; index < clean.length(); index += 1) {
            char character = clean.charAt(index);
            if (Character.isISOControl(character) && character != '\t') {
                return null;
            }
        }
        return clean;
    }

    private static boolean postNotification(
            Context context,
            String id,
            String title,
            String body,
            String path,
            long when
    ) {
        if (!"granted".equals(permissionState(context))) {
            return false;
        }
        ensureChannel(context);
        NotificationManager manager = notificationManager(context);
        if (manager == null) {
            return false;
        }

        Intent openIntent = new Intent(context, MainActivity.class)
                .setAction(ACTION_OPEN_NOTIFICATION)
                .setData(Uri.parse("aiassitant://notification/open/" + Uri.encode(id)))
                .putExtra(EXTRA_PATH, path)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                stableNotificationNumber(id),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context)
                    .setPriority(Notification.PRIORITY_DEFAULT);
        }
        builder.setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setWhen(when)
                .setContentIntent(contentIntent);
        manager.notify(stableNotificationNumber(id), builder.build());
        return true;
    }

    private static void scheduleNext(Context context, List<ScheduledNotification> notifications, long now) {
        ScheduledNotification next = null;
        for (ScheduledNotification notification : notifications) {
            if (notification.triggerAt <= now) {
                continue;
            }
            if (next == null || notification.triggerAt < next.triggerAt) {
                next = notification;
            }
        }
        if (next == null) {
            cancelScheduledAlarm(context);
            return;
        }
        AlarmManager manager = alarmManager(context);
        if (manager == null) {
            return;
        }
        PendingIntent alarmIntent = scheduledAlarmIntent(context);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()) {
            try {
                manager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP,
                        next.triggerAt,
                        alarmIntent
                );
                return;
            } catch (SecurityException permissionChanged) {
                // The special access can be revoked between the capability check and this call.
            }
        }
        manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.triggerAt, alarmIntent);
    }

    private static void cancelScheduledAlarm(Context context) {
        AlarmManager manager = alarmManager(context);
        if (manager != null) {
            manager.cancel(scheduledAlarmIntent(context));
        }
    }

    private static PendingIntent scheduledAlarmIntent(Context context) {
        Intent intent = new Intent(context, ScheduledNotificationReceiver.class)
                .setAction(ACTION_DELIVER_SCHEDULED)
                .setData(Uri.parse("aiassitant://notification/scheduled"));
        return PendingIntent.getBroadcast(
                context,
                SCHEDULE_ALARM_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static List<ScheduledNotification> readStored(Context context) {
        String payload = preferences(context).getString(KEY_SCHEDULED, "[]");
        List<ScheduledNotification> result = new ArrayList<>();
        try {
            JSONArray source = new JSONArray(payload == null ? "[]" : payload);
            if (source.length() > MAX_SCHEDULED_NOTIFICATIONS) {
                return result;
            }
            Set<String> ids = new HashSet<>();
            for (int index = 0; index < source.length(); index += 1) {
                JSONObject row = source.optJSONObject(index);
                ScheduledNotification notification = row == null ? null : validatedNotification(row);
                if (notification != null && ids.add(notification.id)) {
                    result.add(notification);
                }
            }
        } catch (JSONException ignored) {
            // Corrupt local state is discarded without exposing its contents.
        }
        return result;
    }

    private static boolean saveScheduled(Context context, List<ScheduledNotification> notifications) {
        JSONArray target = new JSONArray();
        try {
            for (ScheduledNotification notification : notifications) {
                target.put(notification.toJson());
            }
        } catch (JSONException impossible) {
            return false;
        }
        return preferences(context).edit().putString(KEY_SCHEDULED, target.toString()).commit();
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    private static NotificationManager notificationManager(Context context) {
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static AlarmManager alarmManager(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private static int stableNotificationNumber(String id) {
        int value = id.hashCode() & 0x7fffffff;
        return value == 0 ? 1 : value;
    }

    private static final class ScheduledNotification {
        private final String id;
        private final String title;
        private final String body;
        private final String path;
        private final long triggerAt;

        private ScheduledNotification(String id, String title, String body, String path, long triggerAt) {
            this.id = id;
            this.title = title;
            this.body = body;
            this.path = path;
            this.triggerAt = triggerAt;
        }

        private JSONObject toJson() throws JSONException {
            JSONObject value = new JSONObject();
            value.put("id", id);
            value.put("title", title);
            value.put("body", body);
            value.put("path", path);
            value.put("triggerAt", triggerAt);
            return value;
        }
    }
}
