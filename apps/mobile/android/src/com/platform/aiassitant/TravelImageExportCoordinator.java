package com.platform.aiassitant;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/** Explicit user-selected PNG export. No broad storage permission or arbitrary path. */
final class TravelImageExportCoordinator {
    static final int REQUEST_CODE = 4332;
    interface Host { boolean trusted(); void deliver(JSONObject result); }
    private final Activity activity;
    private final Host host;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private String pendingId;
    private byte[] pendingContent;
    private volatile boolean destroyed;
    TravelImageExportCoordinator(Activity activity, Host host) { this.activity = activity; this.host = host; }
    void request(final String id, final String content) {
        if (!TravelApiPolicy.validRequestId(id) || destroyed) return;
        activity.runOnUiThread(new Runnable() { @Override public void run() {
            if (destroyed || !host.trusted()) return;
            if (pendingId != null) { result(id, false, "다른 파일 저장을 마친 뒤 다시 시도해주세요."); return; }
            byte[] bytes;
            try {
                if (content == null || content.length() > 5600000) throw new IllegalArgumentException();
                bytes = android.util.Base64.decode(content, android.util.Base64.NO_WRAP);
                android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options(); options.inJustDecodeBounds = true;
                android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                if (!"image/png".equals(options.outMimeType) || options.outWidth != 720 || options.outHeight < 720 || options.outHeight > 1720) throw new IllegalArgumentException();
            } catch (Exception invalid) { result(id, false, "일정 이미지 형식을 확인해주세요."); return; }
            if (bytes.length == 0 || bytes.length > 4194304) { result(id, false, "내보낼 이미지가 비어 있거나 너무 길어요."); return; }
            pendingId = id; pendingContent = bytes;
            try {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("image/png");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.putExtra(Intent.EXTRA_TITLE, "Orbit-Trip-" + id + ".png");
                activity.startActivityForResult(intent, REQUEST_CODE);
            } catch (Exception unavailable) { pendingId = null; pendingContent = null; result(id, false, "파일 저장 창을 열지 못했어요."); }
        }});
    }
    void onResult(int resultCode, Intent data) {
        final String id = pendingId; final byte[] bytes = pendingContent;
        pendingId = null; pendingContent = null;
        if (id == null || destroyed) return;
        if (resultCode != Activity.RESULT_OK) { result(id, true, null); return; }
        final Uri uri = data == null ? null : data.getData();
        if (!host.trusted() || uri == null || !"content".equals(uri.getScheme())
                || (data.getFlags() & Intent.FLAG_GRANT_WRITE_URI_PERMISSION) == 0) { result(id, false, "선택한 파일에 저장할 권한을 확인하지 못했어요."); return; }
        writer.execute(new Runnable() { @Override public void run() {
            if (destroyed) return;
            try (OutputStream output = activity.getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException();
                output.write(bytes); output.flush();
                result(id, false, null);
            } catch (Exception failure) { result(id, false, "이미지 파일을 저장하지 못했어요."); }
        }});
    }
    private void result(final String id, final boolean cancelled, final String error) {
        activity.runOnUiThread(new Runnable() { @Override public void run() {
            if (destroyed || !host.trusted()) return;
            try { JSONObject result = new JSONObject().put("requestId", id).put("cancelled", cancelled);
                if (error != null) result.put("error", error); host.deliver(result);
            } catch (Exception ignored) { }
        }});
    }
    void destroy() { destroyed = true; pendingId = null; pendingContent = null; writer.shutdownNow(); }
}
