package com.platform.aiassitant;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

/** Creates a private temporary document and grants one-time read access through the share sheet. */
final class FinanceShareCoordinator {
    interface Host {
        boolean isTrustedOrigin(String expectedOrigin);
        void onShareUnavailable();
    }

    private final Activity activity;
    private final Host host;

    FinanceShareCoordinator(Activity activity, Host host) {
        this.activity = activity;
        this.host = host;
        cleanupExpiredFiles(System.currentTimeMillis());
    }

    boolean share(
            final String expectedOrigin,
            String fileName,
            String mimeType,
            String content
    ) {
        final String normalizedMime = FinanceSharePolicy.normalizeMimeType(mimeType);
        final String normalizedName = FinanceSharePolicy.normalizeFileName(
                fileName,
                normalizedMime
        );
        if (expectedOrigin == null
                || !host.isTrustedOrigin(expectedOrigin)
                || normalizedMime == null
                || normalizedName == null
                || !FinanceSharePolicy.isAllowedContent(content, normalizedMime)) {
            return false;
        }

        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        if (bytes.length <= 0 || bytes.length > FinanceSharePolicy.MAX_DOCUMENT_BYTES) {
            return false;
        }
        cleanupExpiredFiles(System.currentTimeMillis());
        String token = UUID.randomUUID().toString().replace("-", "");
        String cacheFileName = FinanceSharePolicy.managedCacheFileName(token, normalizedMime);
        File directory = shareDirectory();
        if (cacheFileName == null
                || (!directory.isDirectory() && !directory.mkdirs())) {
            return false;
        }
        final File file = new File(directory, cacheFileName);
        if (!writeFile(file, bytes)) {
            return false;
        }

        Uri uri = FinanceShareFileProvider.contentUri(token, normalizedName);
        final Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(normalizedMime);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.putExtra(Intent.EXTRA_TITLE, normalizedName);
        send.setClipData(ClipData.newRawUri(normalizedName, uri));
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        List<?> handlers = activity.getPackageManager().queryIntentActivities(
                send,
                PackageManager.MATCH_DEFAULT_ONLY
        );
        if (handlers == null || handlers.isEmpty()) {
            file.delete();
            return false;
        }

        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (!host.isTrustedOrigin(expectedOrigin)) {
                    file.delete();
                    return;
                }
                Intent chooser = Intent.createChooser(
                        send,
                        activity.getString(R.string.finance_share_chooser_title)
                );
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    activity.startActivity(chooser);
                } catch (ActivityNotFoundException | SecurityException unavailableShare) {
                    file.delete();
                    host.onShareUnavailable();
                }
            }
        });
        return true;
    }

    private File shareDirectory() {
        return new File(activity.getCacheDir(), FinanceSharePolicy.CACHE_DIRECTORY);
    }

    private static boolean writeFile(File file, byte[] bytes) {
        try (FileOutputStream output = new FileOutputStream(file, false)) {
            output.write(bytes);
            output.flush();
            output.getFD().sync();
            return file.isFile() && file.length() == bytes.length;
        } catch (IOException | SecurityException unavailableStorage) {
            file.delete();
            return false;
        }
    }

    private void cleanupExpiredFiles(long now) {
        File directory = shareDirectory();
        File[] files = directory.listFiles();
        if (files == null) {
            return;
        }
        for (File file : files) {
            String name = file.getName();
            long age = now - file.lastModified();
            if (file.isFile()
                    && FinanceSharePolicy.isManagedCacheFileName(name)
                    && (age < 0L || age >= FinanceSharePolicy.CACHE_RETENTION_MILLIS)) {
                file.delete();
            }
        }
    }
}
