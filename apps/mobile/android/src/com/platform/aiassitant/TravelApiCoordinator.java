package com.platform.aiassitant;

import android.content.SharedPreferences;
import android.content.Context;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.RejectedExecutionException;

/** A travel-only loopback client, never a URL/command proxy. Credentials stay native. */
final class TravelApiCoordinator {
    interface Host { void deliver(JSONObject result); }
    private static final String TOKEN_KEY = "orbit_travel_auth_v1";
    private static final String BASE = "http://127.0.0.1:4319/api/travel/";
    private final SharedPreferences preferences;
    private final Host host;
    private final EmbeddedAiRuntime runtime;
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0L,
            TimeUnit.MILLISECONDS, new ArrayBlockingQueue<Runnable>(8));
    private volatile boolean destroyed;
    private volatile HttpURLConnection active;

    TravelApiCoordinator(Context context, SharedPreferences preferences, Host host) {
        this.preferences = preferences;
        this.host = host;
        this.runtime = new EmbeddedAiRuntime(context, preferences);
    }

    String runtimeMode() { return runtime.enabled() ? "embedded" : "standby"; }

    void request(final String requestId, final String action, final String payload) {
        if (destroyed || !TravelApiPolicy.validRequestId(requestId)) return;
        if (payload == null || payload.getBytes(StandardCharsets.UTF_8).length > ("chat-send".equals(action) ? 1048576 : 16384)) {
            emit(requestId, 400, null, "여행 요청이 너무 길어요."); return;
        }
        try {
            worker.execute(new Runnable() {
                @Override
                public void run() { perform(requestId, action, payload); }
            });
        } catch (RejectedExecutionException busy) {
            emit(requestId, 429, null, "연결 요청이 많아요. 잠시 후 다시 시도해주세요.");
        }
    }

    private void perform(String requestId, String action, String payload) {
        HttpURLConnection connection = null;
        try {
            if (destroyed) return;
            JSONObject input = new JSONObject(payload);
            if ("runtime-enable".equals(action) || "runtime-legacy".equals(action)) {
                runtime.select("runtime-enable".equals(action));
                emit(requestId, 200, runtime.availability(), null); return;
            }
            if ("availability".equals(action)) { emit(requestId, 200, runtime.availability(), null); return; }
            String path = TravelApiPolicy.path(action, input.optString("id", ""));
            if (path == null) { emit(requestId, 400, null, "지원하지 않는 여행 요청이에요."); return; }
            boolean pairing = "pair".equals(action);
            boolean embedded = runtime.enabled();
            if (embedded && pairing) { emit(requestId, 400, null, "내장 AI는 ChatGPT 로그인으로 연결해주세요."); return; }
            String token = embedded ? runtime.ensure() : preferences.getString(TOKEN_KEY, "");
            if (!pairing && !token.matches("[a-f0-9]{64}")) {
                emit(requestId, 401, null, "처음 한 번 Termux의 8자리 연결 코드를 입력해주세요. 이후에는 자동 인증돼요."); return;
            }
            if (pairing && !input.optString("code", "").matches("[0-9]{8}")) {
                emit(requestId, 400, null, "8자리 연결 코드를 확인해주세요."); return;
            }
            connection = (HttpURLConnection) new URL((embedded ? EmbeddedAiRuntime.BASE : BASE) + path).openConnection();
            active = connection;
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(3000);
            connection.setReadTimeout("auth-info".equals(action) ? 15000 : 10000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Origin", "https://appassets.androidplatform.net");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            if (!pairing) connection.setRequestProperty("Authorization", "Bearer " + token);
            connection.setRequestMethod(TravelApiPolicy.method(action));
            if ("POST".equals(TravelApiPolicy.method(action))) {
                byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) { output.write(bytes); }
            }
            int status = connection.getResponseCode();
            if (status >= 300 && status < 400) { emit(requestId, 502, null, "여행 연결의 주소 변경을 차단했어요."); return; }
            String contentType = connection.getContentType();
            if (contentType == null || !contentType.startsWith("application/json")) throw new IllegalStateException();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            if (stream == null) throw new IllegalStateException();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream source = stream) {
                byte[] buffer = new byte[4096]; int count;
                while ((count = source.read(buffer)) != -1) {
                    if (output.size() + count > (action.startsWith("chat-") ? 10485760 : 196608)) throw new IllegalStateException();
                    output.write(buffer, 0, count);
                }
            }
            JSONObject data = new JSONObject(new String(output.toByteArray(), StandardCharsets.UTF_8));
            if (status >= 400) {
                String message = data.optString("error", "여행 연결에 실패했어요.");
                emit(requestId, status, null, message.length() <= 250 ? message : "여행 연결에 실패했어요."); return;
            }
            if (pairing) {
                String credential = data.optString("token", "");
                if (!credential.matches("[a-f0-9]{64}") || destroyed
                        || !preferences.edit().putString(TOKEN_KEY, credential).commit()) throw new IllegalStateException();
                data = new JSONObject().put("connected", true);
            }
            emit(requestId, status, data, null);
        } catch (Exception unavailable) {
            emit(requestId, 0, null, runtime.enabled()
                    ? (unavailable instanceof java.io.IOException && unavailable.getMessage() != null && unavailable.getMessage().matches("^[가-힣].*" ) ? unavailable.getMessage() : "내장 AI에 연결하지 못했어요. AI 사용하기에서 다시 확인해주세요.")
                    : "대기 연결이 꺼져 있어요. Termux를 열고 orbit-travel을 실행한 뒤 다시 확인해주세요.");
        } finally {
            if (connection != null) connection.disconnect();
            active = null;
        }
    }

    private void emit(String requestId, int status, JSONObject data, String error) {
        if (destroyed) return;
        try {
            JSONObject result = new JSONObject().put("requestId", requestId).put("status", status);
            if (error != null) result.put("error", error); else result.put("data", data);
            host.deliver(result);
        } catch (Exception ignored) { /* No payload or credential logging. */ }
    }

    void destroy() {
        destroyed = true;
        runtime.destroy();
        HttpURLConnection connection = active;
        if (connection != null) connection.disconnect();
        worker.shutdownNow();
    }
}
