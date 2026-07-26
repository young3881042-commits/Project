package com.platform.aiassitant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ScheduledNotificationReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null
                && AppNotificationCoordinator.ACTION_DELIVER_SCHEDULED.equals(intent.getAction())) {
            AppNotificationCoordinator.deliverScheduled(context.getApplicationContext());
        }
    }
}
