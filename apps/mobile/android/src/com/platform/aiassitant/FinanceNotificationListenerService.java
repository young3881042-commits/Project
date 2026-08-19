package com.platform.aiassitant;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.ArrayList;
import java.util.List;

public final class FinanceNotificationListenerService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification posted) {
        if (posted == null
                || !FinanceNotificationParser.isSupportedPackage(posted.getPackageName())
                || !FinanceTransactionQueue.isCollectionEnabled(getApplicationContext())) {
            return;
        }
        Notification notification = posted.getNotification();
        if (notification == null
                || (notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) {
            return;
        }
        FinanceNotificationParser.Candidate candidate = FinanceNotificationParser.parse(
                posted.getPackageName(),
                posted.getKey(),
                posted.getPostTime() > 0L
                        ? posted.getPostTime()
                        : System.currentTimeMillis(),
                notificationTextParts(notification.extras)
        );
        if (candidate != null) {
            FinanceTransactionQueue.enqueue(getApplicationContext(), candidate);
        }
    }

    private static List<String> notificationTextParts(Bundle extras) {
        List<String> parts = new ArrayList<>();
        if (extras == null) {
            return parts;
        }
        add(parts, extras.getCharSequence(Notification.EXTRA_TITLE));
        add(parts, extras.getCharSequence(Notification.EXTRA_TITLE_BIG));
        add(parts, extras.getCharSequence(Notification.EXTRA_TEXT));
        add(parts, extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        add(parts, extras.getCharSequence(Notification.EXTRA_SUB_TEXT));
        add(parts, extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));
        CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (lines != null) {
            for (CharSequence line : lines) {
                add(parts, line);
            }
        }
        return parts;
    }

    private static void add(List<String> parts, CharSequence value) {
        if (value != null && parts.size() < 12) {
            parts.add(value.toString());
        }
    }
}
