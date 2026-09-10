package com.platform.aiassitant;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.util.Locale;

/** Only user-picked document URIs for the AI composer. No broad storage permission. */
final class AiChatAttachmentPolicy {
    static final int REQUEST_CODE = 7364;
    static final String[] MIME_TYPES = { "application/pdf", "text/plain", "text/markdown", "text/csv", "application/json" };
    static boolean acceptsRequestedTypes(String[] types) {
        if (types == null || types.length == 0) return false;
        boolean found = false;
        for (String raw : types) {
            if (raw == null) continue;
            for (String type : raw.split(",")) {
                String value = type.trim().toLowerCase(Locale.ROOT);
                if (value.isEmpty()) continue;
                if (!(value.matches("\\.(pdf|txt|md|markdown|csv|json|log)")
                        || value.matches("(application/(pdf|json)|text/(plain|markdown|csv))"))) return false;
                found = true;
            }
        }
        return found;
    }
    static boolean allowedName(String name) {
        return name != null && name.length() <= 160 && !name.matches(".*[\\p{Cntrl}/\\\\].*")
                && name.toLowerCase(Locale.ROOT).matches(".+\\.(pdf|txt|md|markdown|csv|json|log)");
    }
    static boolean allowedDocument(Context context, Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme())) return false;
        try (Cursor cursor = context.getContentResolver().query(uri,
                new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
            if (cursor == null || !cursor.moveToFirst()) return false;
            int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
            int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
            if (nameColumn < 0 || !allowedName(cursor.getString(nameColumn))) return false;
            if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) {
                long size = cursor.getLong(sizeColumn);
                if (size > 5 * 1024 * 1024 || size == 0) return false;
            }
            return true; // Actual bytes and type are bounded/decoded again in the composer.
        } catch (Exception unavailable) { return false; }
    }
}
