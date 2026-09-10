package com.platform.aiassitant;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Map;

/** APK-owned runtime. No downloaded code, external storage, shell or Termux permissions. */
final class EmbeddedAiRuntime {
    private final Context context;
    private final SharedPreferences preferences;
    private final File home;
    private volatile Process process;
    private volatile boolean destroyed;
    private String credential;
    private static final String MODE = "orbit_ai_runtime_v1";
    static final String BASE = "http://127.0.0.1:4320/api/travel/";

    EmbeddedAiRuntime(Context context, SharedPreferences preferences) {
        this.context = context.getApplicationContext(); this.preferences = preferences;
        home = new File(context.getFilesDir(), "orbit-ai");
    }
    boolean supported() {
        return Build.VERSION.SDK_INT >= 30
            && new File(context.getApplicationInfo().nativeLibraryDir, "liborbit_node.so").canExecute()
            && new File(context.getApplicationInfo().nativeLibraryDir, "liborbit_codex.so").canExecute();
    }
    boolean enabled() {
        return preferences.getBoolean(MODE, !preferences.contains("orbit_travel_auth_v1"));
    }
    void select(boolean embedded) throws Exception {
        if (embedded && !supported()) throw new IOException("이 APK의 내장 AI는 Android 11 이상 arm64 기기에서 사용할 수 있어요.");
        if (!preferences.edit().putBoolean(MODE, embedded).commit()) throw new IOException("연결 설정을 저장하지 못했어요.");
        if (!embedded) stop();
    }
    JSONObject availability() throws Exception {
        return new JSONObject().put("automatic", enabled()).put("embeddedSupported", supported())
            .put("mode", enabled() ? "embedded" : "standby")
            .put("authenticated", enabled() || preferences.getString("orbit_travel_auth_v1", "").matches("[a-f0-9]{64}"));
    }
    private void copyAsset(String name, File target) throws Exception {
        try (InputStream input = context.getAssets().open(name); OutputStream output = new FileOutputStream(target)) {
            byte[] bytes = new byte[16384]; int count;
            while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
        }
        target.setReadable(false, false); target.setReadable(true, true);
        target.setWritable(false, false); target.setWritable(true, true);
    }
    private boolean alive() {
        Process current = process;
        if (current == null) return false;
        try { current.exitValue(); return false; } catch (IllegalThreadStateException running) { return true; }
    }
    private boolean ready() {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(BASE + "status").openConnection();
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(200); connection.setReadTimeout(200);
            connection.setRequestProperty("Origin", "https://appassets.androidplatform.net");
            connection.setRequestProperty("Authorization", "Bearer " + credential);
            return connection.getResponseCode() == 200;
        } catch (Exception error) { return false; }
        finally { if (connection != null) connection.disconnect(); }
    }
    synchronized String ensure() throws Exception {
        if (destroyed) throw new IOException("앱 연결이 종료됐어요.");
        if (!supported()) throw new IOException("내장 AI 실행 파일이 없거나 지원하지 않는 기기예요. Android 11 이상 arm64용 APK를 확인해주세요.");
        // A slow health response must never kill a live generation or discard its in-memory job.
        // The actual request has its own timeout; only restart an exited process.
        if (alive()) return credential;
        stop();
        File state = new File(home, ".local/state/orbit-travel");
        File temp = new File(home, "tmp");
        File codex = new File(home, ".codex");
        if ((!state.isDirectory() && !state.mkdirs()) || (!temp.isDirectory() && !temp.mkdirs()) || (!codex.isDirectory() && !codex.mkdirs())) throw new IOException("AI 저장 공간을 만들지 못했어요.");
        File auth = new File(state, "auth");
        if (auth.isFile()) {
            try (InputStream input = new FileInputStream(auth)) {
                byte[] bytes = new byte[65]; int count = input.read(bytes);
                credential = new String(bytes, 0, Math.max(0, count), StandardCharsets.UTF_8).trim();
            }
            if (!credential.matches("[a-f0-9]{64}")) throw new IOException("앱 내부 연결 인증을 읽지 못했어요.");
        } else {
            byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
            StringBuilder text = new StringBuilder();
            for (byte value : bytes) text.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            credential = text.toString();
            try (OutputStream output = new FileOutputStream(auth)) { output.write(credential.getBytes(StandardCharsets.UTF_8)); }
            auth.setReadable(false, false); auth.setReadable(true, true); auth.setWritable(false, false); auth.setWritable(true, true);
        }
        File script = new File(home, "runtime.mjs"), certificates = new File(home, "ca.pem");
        copyAsset("orbit-travel-runtime.mjs", script); copyAsset("orbit-ca.pem", certificates);
        String library = context.getApplicationInfo().nativeLibraryDir;
        ProcessBuilder builder = new ProcessBuilder("/system/bin/linker64", new File(library, "liborbit_node.so").getAbsolutePath(), script.getAbsolutePath(), "--embedded");
        builder.directory(home); builder.redirectErrorStream(true);
        Map<String, String> env = builder.environment(); env.clear();
        env.put("HOME", home.getAbsolutePath()); env.put("TMPDIR", temp.getAbsolutePath());
        env.put("CODEX_HOME", codex.getAbsolutePath()); env.put("PATH", "/system/bin");
        env.put("ANDROID_ROOT", "/system"); env.put("ANDROID_DATA", "/data");
        env.put("LD_LIBRARY_PATH", library); env.put("SSL_CERT_FILE", certificates.getAbsolutePath());
        env.put("NODE_EXTRA_CA_CERTS", certificates.getAbsolutePath());
        env.put("ORBIT_NODE_BINARY", new File(library, "liborbit_node.so").getAbsolutePath());
        env.put("ORBIT_EMBEDDED", "1"); env.put("ORBIT_CODEX_BINARY", new File(library, "liborbit_codex.so").getAbsolutePath());
        if (destroyed) throw new IOException("앱 연결이 종료됐어요.");
        final Process child = builder.start(); process = child;
        if (destroyed) { stop(); throw new IOException("앱 연결이 종료됐어요."); }
        Thread drain = new Thread(new Runnable() { public void run() {
            try (InputStream input = child.getInputStream()) { byte[] bytes = new byte[4096]; while (input.read(bytes) != -1) { /* Never log auth or personal data. */ } }
            catch (Exception ignored) { }
        } }, "orbit-ai-output"); drain.setDaemon(true); drain.start();
        for (int attempt = 0; attempt < 30 && !destroyed; attempt++) {
            if (ready()) return credential;
            if (!alive()) throw new IOException("내장 AI 엔진이 시작되지 않았어요. 기기 호환성을 확인해야 해요.");
            Thread.sleep(100);
        }
        stop(); throw new IOException("내장 AI 시작 응답이 늦어요. 다시 시도해주세요.");
    }
    private void stop() { Process current = process; process = null; if (current != null) current.destroy(); }
    void destroy() { destroyed = true; stop(); }
}
