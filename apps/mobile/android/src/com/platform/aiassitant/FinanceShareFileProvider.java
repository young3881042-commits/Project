package com.platform.aiassitant;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Read-only, grant-only provider for short-lived files sent through Android's share sheet. */
public final class FinanceShareFileProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        File directory = shareDirectory();
        return directory != null && (directory.isDirectory() || directory.mkdirs());
    }

    static Uri contentUri(String token, String fileName) {
        return new Uri.Builder()
                .scheme("content")
                .authority(FinanceSharePolicy.AUTHORITY)
                .appendPath(token)
                .appendPath(fileName)
                .build();
    }

    @Override
    public String getType(Uri uri) {
        FinanceSharePolicy.ParsedPath path = parsedPath(uri);
        return path == null ? null : path.mimeType;
    }

    @Override
    public Cursor query(
            Uri uri,
            String[] projection,
            String selection,
            String[] selectionArgs,
            String sortOrder
    ) {
        FinanceSharePolicy.ParsedPath path = parsedPath(uri);
        File file = sharedFile(path);
        if (path == null || file == null || !file.isFile()) {
            return null;
        }
        String[] columns = projection == null || projection.length == 0
                ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}
                : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) {
                row.add(path.fileName);
            } else if (OpenableColumns.SIZE.equals(column)) {
                row.add(file.length());
            } else {
                row.add(null);
            }
        }
        return cursor;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) {
            throw new FileNotFoundException("Finance share files are read-only");
        }
        FinanceSharePolicy.ParsedPath path = parsedPath(uri);
        File file = sharedFile(path);
        if (file == null
                || !file.isFile()
                || file.length() <= 0L
                || file.length() > FinanceSharePolicy.MAX_DOCUMENT_BYTES) {
            throw new FileNotFoundException("Finance share file is unavailable");
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Finance share files are read-only");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    private FinanceSharePolicy.ParsedPath parsedPath(Uri uri) {
        if (uri == null
                || !"content".equals(uri.getScheme())
                || !FinanceSharePolicy.AUTHORITY.equals(uri.getAuthority())) {
            return null;
        }
        return FinanceSharePolicy.parsePathSegments(uri.getPathSegments());
    }

    private File shareDirectory() {
        return getContext() == null
                ? null
                : new File(getContext().getCacheDir(), FinanceSharePolicy.CACHE_DIRECTORY);
    }

    private File sharedFile(FinanceSharePolicy.ParsedPath path) {
        File directory = shareDirectory();
        if (path == null || directory == null || !directory.isDirectory()) {
            return null;
        }
        return new File(directory, path.cacheFileName);
    }
}
