package com.platform.aiassitant;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PushbackInputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.NoRouteToHostException;
import java.net.Proxy;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.net.UnknownHostException;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.net.ssl.SSLException;

/**
 * Narrow native transport for LifeHub Bridge API calls. This class deliberately
 * exposes no generic headers, redirect handling, TLS overrides, or arbitrary
 * URL paths.
 */
final class BridgeHttpProxy {
    static final String RESPONSE_EVENT = "lifehub:native-bridge-response";
    static final String STREAM_EVENT = "lifehub:native-bridge-stream";

    private static final int MAX_REQUEST_ID_LENGTH = 128;
    private static final int MAX_URL_LENGTH = 4096;
    private static final int MAX_REQUEST_BODY_BYTES = 64 * 1024;
    private static final int MAX_FOOD_ANALYZE_REQUEST_BODY_BYTES = 2 * 1024 * 1024 + 256 * 1024;
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private static final int MAX_ERROR_RESPONSE_BYTES = 64 * 1024;
    private static final int MAX_SSE_LINE_BYTES = 64 * 1024;
    private static final int MAX_SSE_EVENT_BYTES = 256 * 1024;
    private static final int MAX_LAST_EVENT_ID_LENGTH = 1024;
    private static final int MAX_ACTIVE_REQUESTS = 16;
    private static final int CONNECT_TIMEOUT_MILLIS = 10_000;
    private static final int REQUEST_READ_TIMEOUT_MILLIS = 30_000;
    private static final int STREAM_READ_TIMEOUT_MILLIS = 90_000;

    private final SecureTokenStore secureTokenStore;
    private final EventSink eventSink;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private final ConcurrentMap<String, ActiveCall> activeCalls = new ConcurrentHashMap<>();
    private final AtomicBoolean closed = new AtomicBoolean(false);

    interface EventSink {
        void dispatch(String eventName, String trustedOrigin, JSONObject detail);
    }

    BridgeHttpProxy(SecureTokenStore secureTokenStore, EventSink eventSink) {
        this.secureTokenStore = secureTokenStore;
        this.eventSink = eventSink;
    }

    boolean request(
            String trustedOrigin,
            String requestId,
            String rawUrl,
            String rawMethod,
            String body,
            String tokenKey
    ) {
        if (closed.get() || !isValidTrustedOrigin(trustedOrigin) || !isValidRequestId(requestId)) {
            return false;
        }
        String method = rawMethod == null ? "" : rawMethod.trim().toUpperCase(Locale.US);
        if (!("GET".equals(method) || "POST".equals(method))) {
            return false;
        }
        URI uri = parseBridgeUri(rawUrl);
        if (uri == null) {
            return false;
        }
        byte[] bodyBytes = body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8);
        if (bodyBytes.length > requestBodyLimitBytes(uri, method)
                || ("GET".equals(method) && bodyBytes.length > 0)) {
            return false;
        }
        String token = tokenForRequest(uri, method, tokenKey);
        if (token == null) {
            return false;
        }
        PreparedRequest prepared = new PreparedRequest(
                trustedOrigin,
                requestId,
                uri,
                method,
                bodyBytes,
                token,
                ""
        );
        return submit(prepared, false);
    }

    boolean stream(
            String trustedOrigin,
            String requestId,
            String rawUrl,
            String tokenKey,
            String lastEventId
    ) {
        if (closed.get() || !isValidTrustedOrigin(trustedOrigin) || !isValidRequestId(requestId)) {
            return false;
        }
        URI uri = parseBridgeUri(rawUrl);
        if (uri == null || !isValidLastEventId(lastEventId)) {
            return false;
        }
        String token = tokenForRequest(uri, "GET", tokenKey);
        if (token == null) {
            return false;
        }
        PreparedRequest prepared = new PreparedRequest(
                trustedOrigin,
                requestId,
                uri,
                "GET",
                new byte[0],
                token,
                lastEventId == null ? "" : lastEventId
        );
        return submit(prepared, true);
    }

    boolean cancel(String trustedOrigin, String requestId) {
        if (!isValidTrustedOrigin(trustedOrigin) || !isValidRequestId(requestId)) {
            return false;
        }
        ActiveCall call = activeCalls.get(requestId);
        return call != null
                && trustedOrigin.equals(call.request.trustedOrigin)
                && call.cancel(true);
    }

    void shutdown() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        for (ActiveCall call : activeCalls.values()) {
            call.cancel(false);
        }
        activeCalls.clear();
        executor.shutdownNow();
    }

    void cancelAll(boolean notify) {
        for (ActiveCall call : activeCalls.values()) {
            call.cancel(notify);
        }
    }

    private boolean submit(PreparedRequest request, boolean stream) {
        final ActiveCall call = new ActiveCall(request, stream);
        synchronized (activeCalls) {
            if (closed.get() || activeCalls.size() >= MAX_ACTIVE_REQUESTS) {
                return false;
            }
            if (activeCalls.putIfAbsent(request.requestId, call) != null) {
                return false;
            }
        }
        try {
            Future<?> future = executor.submit(new Runnable() {
                @Override
                public void run() {
                    try {
                        if (call.stream) {
                            executeStream(call);
                        } else {
                            executeRequest(call);
                        }
                    } finally {
                        call.closeResources();
                        activeCalls.remove(call.request.requestId, call);
                    }
                }
            });
            call.attachFuture(future);
            return true;
        } catch (RejectedExecutionException rejected) {
            activeCalls.remove(request.requestId, call);
            return false;
        }
    }

    private void executeRequest(ActiveCall call) {
        try {
            URL destination = resolveAllowedDestination(call.request.uri);
            if (call.isCancelled()) return;

            HttpURLConnection connection = openConnection(call.request, destination, false);
            call.attachConnection(connection);
            writeRequestBody(connection, call.request);
            if (call.isCancelled()) return;

            int status = connection.getResponseCode();
            String contentType = safeContentType(connection.getContentType());
            InputStream responseStream = responseStream(connection, status);
            call.attachInput(responseStream);
            String responseBody = readLimitedText(responseStream, MAX_RESPONSE_BYTES);
            boolean ok = status >= 200 && status < 300;
            if (ok && isPairingClaimRequest(call.request)) {
                responseBody = secureAndRedactPairingToken(call.request, responseBody);
            }
            call.finishResponse(responseDetail(
                    call.request.requestId,
                    ok,
                    status,
                    responseBody,
                    contentType,
                    ok ? null : errorObject("http_error", "Bridge returned HTTP " + status + ".")
            ));
        } catch (ResponseTooLargeException tooLarge) {
            call.failResponse(0, "response_too_large", "Bridge response exceeded the native size limit.");
        } catch (PairingTokenException pairingError) {
            call.failResponse(0, pairingError.code, pairingError.getMessage());
        } catch (SocketTimeoutException timeout) {
            call.failResponse(0, "timeout", "Bridge request timed out.");
        } catch (SSLException tlsError) {
            call.failResponse(0, "tls_error", "Bridge TLS validation failed.");
        } catch (SecurityException blocked) {
            call.failResponse(0, "blocked_address", "The HTTP Bridge address is not a permitted local address.");
        } catch (UnknownHostException | ConnectException | NoRouteToHostException networkError) {
            call.failResponse(0, "network_error", "Bridge could not be reached.");
        } catch (IOException networkError) {
            if (!call.isCancelled()) {
                call.failResponse(0, "network_error", "Bridge connection failed.");
            }
        } catch (RuntimeException invalidResponse) {
            if (!call.isCancelled()) {
                call.failResponse(0, "invalid_response", "Bridge returned an invalid response.");
            }
        }
    }

    private void executeStream(ActiveCall call) {
        try {
            URL destination = resolveAllowedDestination(call.request.uri);
            if (call.isCancelled()) return;

            HttpURLConnection connection = openConnection(call.request, destination, true);
            call.attachConnection(connection);
            int status = connection.getResponseCode();
            String contentType = safeContentType(connection.getContentType());
            if (status < 200 || status >= 300) {
                InputStream errorStream = responseStream(connection, status);
                call.attachInput(errorStream);
                readLimitedText(errorStream, MAX_ERROR_RESPONSE_BYTES);
                call.failStream(status, "http_error", "Bridge returned HTTP " + status + ".");
                return;
            }
            if (!contentType.toLowerCase(Locale.US).startsWith("text/event-stream")) {
                call.failStream(status, "invalid_response", "Bridge stream did not return text/event-stream.");
                return;
            }

            InputStream input = connection.getInputStream();
            call.attachInput(input);
            call.dispatchStream(streamOpenDetail(call.request.requestId, status, contentType), false);
            readServerSentEvents(call, input);
            if (!call.isCancelled()) {
                call.dispatchStream(streamTypeDetail(call.request.requestId, "end"), true);
            }
        } catch (ResponseTooLargeException tooLarge) {
            call.failStream(0, "response_too_large", "A Bridge stream event exceeded the native size limit.");
        } catch (SocketTimeoutException timeout) {
            call.failStream(0, "timeout", "Bridge stream timed out.");
        } catch (SSLException tlsError) {
            call.failStream(0, "tls_error", "Bridge TLS validation failed.");
        } catch (SecurityException blocked) {
            call.failStream(0, "blocked_address", "The HTTP Bridge address is not a permitted local address.");
        } catch (UnknownHostException | ConnectException | NoRouteToHostException networkError) {
            call.failStream(0, "network_error", "Bridge could not be reached.");
        } catch (IOException networkError) {
            if (!call.isCancelled()) {
                call.failStream(0, "network_error", "Bridge stream connection failed.");
            }
        } catch (RuntimeException invalidResponse) {
            if (!call.isCancelled()) {
                call.failStream(0, "invalid_response", "Bridge returned an invalid stream response.");
            }
        }
    }

    private static HttpURLConnection openConnection(
            PreparedRequest request,
            URL destination,
            boolean stream
    ) throws IOException {
        URLConnection rawConnection = destination.openConnection(Proxy.NO_PROXY);
        if (!(rawConnection instanceof HttpURLConnection)) {
            throw new IOException("Unsupported connection type");
        }
        HttpURLConnection connection = (HttpURLConnection) rawConnection;
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MILLIS);
        connection.setReadTimeout(
                stream
                        ? STREAM_READ_TIMEOUT_MILLIS
                        : requestReadTimeoutMillis(request.uri, request.method)
        );
        connection.setUseCaches(false);
        connection.setDoInput(true);
        connection.setRequestMethod(request.method);
        connection.setRequestProperty("Accept", stream ? "text/event-stream" : "application/json");
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("Cache-Control", "no-cache");
        if (!request.token.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + request.token);
        }
        if (stream && !request.lastEventId.isEmpty()) {
            connection.setRequestProperty("Last-Event-ID", request.lastEventId);
        }
        if ("POST".equals(request.method)) {
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(request.body.length);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        }
        return connection;
    }

    private static void writeRequestBody(HttpURLConnection connection, PreparedRequest request) throws IOException {
        if (!"POST".equals(request.method)) {
            return;
        }
        OutputStream output = connection.getOutputStream();
        try {
            output.write(request.body);
            output.flush();
        } finally {
            closeQuietly(output);
        }
    }

    private static InputStream responseStream(HttpURLConnection connection, int status) throws IOException {
        if (status >= 400) {
            InputStream errorStream = connection.getErrorStream();
            return errorStream == null ? new EmptyInputStream() : errorStream;
        }
        InputStream input = connection.getInputStream();
        return input == null ? new EmptyInputStream() : input;
    }

    private static String readLimitedText(InputStream input, int limit) throws IOException {
        if (input == null) {
            return "";
        }
        ByteArrayOutputStream output = new ByteArrayOutputStream(Math.min(limit, 8192));
        byte[] buffer = new byte[8192];
        int total = 0;
        int count;
        while ((count = input.read(buffer)) != -1) {
            total += count;
            if (total > limit) {
                throw new ResponseTooLargeException();
            }
            output.write(buffer, 0, count);
        }
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private static void readServerSentEvents(ActiveCall call, InputStream rawInput) throws IOException {
        PushbackInputStream input = new PushbackInputStream(new BufferedInputStream(rawInput), 1);
        StringBuilder data = new StringBuilder();
        String eventName = "message";
        String eventId = call.request.lastEventId;
        Long retry = null;
        int eventBytes = 0;
        boolean firstLine = true;

        while (!call.isCancelled()) {
            String line = readUtf8Line(input, MAX_SSE_LINE_BYTES);
            if (line == null) {
                if (data.length() > 0) {
                    dispatchSseEvent(call, eventName, data, eventId, retry);
                }
                return;
            }
            if (firstLine) {
                firstLine = false;
                if (!line.isEmpty() && line.charAt(0) == '\ufeff') {
                    line = line.substring(1);
                }
            }
            if (line.isEmpty()) {
                if (data.length() > 0) {
                    dispatchSseEvent(call, eventName, data, eventId, retry);
                }
                data.setLength(0);
                eventName = "message";
                retry = null;
                eventBytes = 0;
                continue;
            }
            if (line.charAt(0) == ':') {
                continue;
            }

            int separator = line.indexOf(':');
            String field = separator < 0 ? line : line.substring(0, separator);
            String value = separator < 0 ? "" : line.substring(separator + 1);
            if (value.startsWith(" ")) {
                value = value.substring(1);
            }
            if ("data".equals(field)) {
                int valueBytes = value.getBytes(StandardCharsets.UTF_8).length + 1;
                eventBytes += valueBytes;
                if (eventBytes > MAX_SSE_EVENT_BYTES) {
                    throw new ResponseTooLargeException();
                }
                if (data.length() > 0) data.append('\n');
                data.append(value);
            } else if ("event".equals(field)) {
                eventName = value.isEmpty() ? "message" : value;
            } else if ("id".equals(field) && value.indexOf('\u0000') < 0) {
                eventId = value;
            } else if ("retry".equals(field) && isAsciiDigits(value)) {
                try {
                    long parsed = Long.parseLong(value);
                    retry = parsed <= Integer.MAX_VALUE ? parsed : null;
                } catch (NumberFormatException ignored) {
                    retry = null;
                }
            }
        }
    }

    private static void dispatchSseEvent(
            ActiveCall call,
            String eventName,
            StringBuilder data,
            String eventId,
            Long retry
    ) {
        if (call.isCancelled()) return;
        JSONObject detail = new JSONObject();
        try {
            detail.put("requestId", call.request.requestId);
            detail.put("type", "event");
            detail.put("event", eventName);
            detail.put("data", data.toString());
            detail.put("id", eventId == null ? "" : eventId);
            detail.put("retry", retry == null ? JSONObject.NULL : retry);
            call.dispatchStream(detail, false);
        } catch (JSONException impossible) {
            call.failStream(0, "invalid_response", "Bridge stream event could not be decoded.");
        }
    }

    private static String readUtf8Line(PushbackInputStream input, int limit) throws IOException {
        ByteArrayOutputStream line = new ByteArrayOutputStream(256);
        boolean readAny = false;
        while (true) {
            int value = input.read();
            if (value == -1) {
                return readAny ? new String(line.toByteArray(), StandardCharsets.UTF_8) : null;
            }
            readAny = true;
            if (value == '\n') {
                return new String(line.toByteArray(), StandardCharsets.UTF_8);
            }
            if (value == '\r') {
                int next = input.read();
                if (next != -1 && next != '\n') {
                    input.unread(next);
                }
                return new String(line.toByteArray(), StandardCharsets.UTF_8);
            }
            if (line.size() >= limit) {
                throw new ResponseTooLargeException();
            }
            line.write(value);
        }
    }

    private String tokenForRequest(URI uri, String method, String tokenKey) {
        String normalizedKey = tokenKey == null ? "" : tokenKey;
        if (normalizedKey.isEmpty()) {
            return "POST".equals(method) && isUnauthenticatedPairingPath(uri.getPath()) ? "" : null;
        }
        if (!SecureTokenStore.isAllowedTokenKey(normalizedKey)) {
            return null;
        }
        String token = secureTokenStore.getForOrigin(normalizedKey, bridgeOrigin(uri));
        return token == null || token.isEmpty() ? null : token;
    }

    private static boolean isUnauthenticatedPairingPath(String path) {
        return "/api/pair/request".equals(path) || "/api/pair/approve".equals(path);
    }

    private static boolean isPairingClaimRequest(PreparedRequest request) {
        return "POST".equals(request.method)
                && request.token.isEmpty()
                && "/api/pair/approve".equals(request.uri.getPath());
    }

    private String secureAndRedactPairingToken(PreparedRequest request, String responseBody)
            throws PairingTokenException {
        final JSONObject root;
        try {
            root = new JSONObject(responseBody);
        } catch (JSONException invalidJson) {
            throw new PairingTokenException(
                    "invalid_pairing_response",
                    "Bridge returned an invalid pairing response."
            );
        }

        JSONObject payload = root.optJSONObject("data");
        if (payload == null) payload = root;
        JSONObject device = payload.optJSONObject("device");
        String token = firstNonEmpty(
                payload.optString("token", ""),
                payload.optString("deviceToken", ""),
                payload.optString("pairingToken", ""),
                device == null ? "" : device.optString("token", "")
        );
        if (token.isEmpty()) {
            // A 202 pending response contains no credential and is safe to forward.
            return responseBody;
        }

        String deviceId = firstNonEmpty(
                device == null ? "" : device.optString("id", ""),
                payload.optString("deviceId", ""),
                payload.optString("pcId", ""),
                payload.optString("bridgeId", ""),
                payload.optString("id", "")
        );
        String key = SecureTokenStore.TOKEN_KEY_PREFIX + deviceId;
        if (!SecureTokenStore.isAllowedTokenKey(key)) {
            throw new PairingTokenException(
                    "invalid_pairing_response",
                    "Bridge returned an invalid paired-device identifier."
            );
        }

        scrubTokenFields(root);
        try {
            payload.put("tokenStored", true);
            payload.put("tokenKey", key);
        } catch (JSONException impossible) {
            throw new PairingTokenException(
                    "invalid_pairing_response",
                    "Bridge pairing metadata could not be decoded."
            );
        }
        String sanitized = root.toString();
        if (sanitized.contains(token)) {
            throw new PairingTokenException(
                    "invalid_pairing_response",
                    "Bridge pairing response contained an unexpected credential field."
            );
        }
        if (!secureTokenStore.put(key, token, bridgeOrigin(request.uri))) {
            throw new PairingTokenException(
                    "secure_storage_failed",
                    "The paired-device token could not be saved in Android Keystore."
            );
        }
        return sanitized;
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isEmpty()) return value;
        }
        return "";
    }

    private static void scrubTokenFields(Object value) {
        if (value instanceof JSONObject) {
            JSONObject object = (JSONObject) value;
            List<String> keys = new ArrayList<>();
            Iterator<String> iterator = object.keys();
            while (iterator.hasNext()) keys.add(iterator.next());
            for (String key : keys) {
                if (key.toLowerCase(Locale.US).contains("token")) {
                    object.remove(key);
                } else {
                    scrubTokenFields(object.opt(key));
                }
            }
            return;
        }
        if (value instanceof org.json.JSONArray) {
            org.json.JSONArray array = (org.json.JSONArray) value;
            for (int index = 0; index < array.length(); index += 1) {
                scrubTokenFields(array.opt(index));
            }
        }
    }

    static String bridgeOrigin(URI uri) {
        String scheme = uri.getScheme().toLowerCase(Locale.US);
        String host = uri.getHost().toLowerCase(Locale.US);
        if (host.indexOf(':') >= 0 && !host.startsWith("[")) {
            host = "[" + host + "]";
        }
        int port = uri.getPort() == -1 ? ("https".equals(scheme) ? 443 : 80) : uri.getPort();
        return scheme + "://" + host + ":" + port;
    }

    static URI parseBridgeUri(String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty() || rawUrl.length() > MAX_URL_LENGTH || !rawUrl.equals(rawUrl.trim())) {
            return null;
        }
        try {
            URI uri = new URI(rawUrl);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.US);
            String host = uri.getHost();
            int port = uri.getPort();
            String rawPath = uri.getRawPath();
            String path = uri.getPath();
            String normalizedRawPath = rawPath == null ? "" : rawPath;
            if (!("http".equals(scheme) || "https".equals(scheme))
                    || host == null
                    || host.isEmpty()
                    || uri.getRawUserInfo() != null
                    || uri.getFragment() != null
                    || (port != -1 && (port < 1 || port > 65535))
                    || path == null
                    || !path.startsWith("/api/")
                    || path.contains("\\")
                    || hasDotSegment(path)
                    || normalizedRawPath.indexOf('%') >= 0) {
                return null;
            }
            return uri;
        } catch (URISyntaxException invalid) {
            return null;
        }
    }

    static int requestBodyLimitBytes(URI uri, String method) {
        return isFoodAnalyzeRequest(uri, method)
                ? MAX_FOOD_ANALYZE_REQUEST_BODY_BYTES
                : MAX_REQUEST_BODY_BYTES;
    }

    static int requestReadTimeoutMillis(URI uri, String method) {
        return isFoodAnalyzeRequest(uri, method)
                ? STREAM_READ_TIMEOUT_MILLIS
                : REQUEST_READ_TIMEOUT_MILLIS;
    }

    private static boolean isFoodAnalyzeRequest(URI uri, String method) {
        return uri != null
                && "POST".equals(method)
                && "/api/food/analyze".equals(uri.getPath());
    }

    private static boolean hasDotSegment(String path) {
        String[] segments = path.split("/", -1);
        for (String segment : segments) {
            if (".".equals(segment) || "..".equals(segment)) {
                return true;
            }
        }
        return false;
    }

    private static URL resolveAllowedDestination(URI uri) throws IOException {
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            return uri.toURL();
        }
        String host = hostForResolution(uri.getHost());
        InetAddress[] addresses = InetAddress.getAllByName(host);
        if (addresses.length == 0) {
            throw new UnknownHostException();
        }
        for (InetAddress address : addresses) {
            if (!isAllowedLocalAddress(address)) {
                throw new SecurityException("Blocked non-local address");
            }
        }
        String rawPath = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        String file = uri.getRawQuery() == null ? rawPath : rawPath + "?" + uri.getRawQuery();
        int port = uri.getPort() == -1 ? 80 : uri.getPort();
        // Pin cleartext HTTP to the address that passed the local-network check.
        // This avoids a second hostname lookup after validation (DNS rebinding).
        return new URL("http", addresses[0].getHostAddress(), port, file);
    }

    private static String hostForResolution(String host) {
        String normalized = host;
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return normalized.replace("%25", "%");
    }

    static boolean isAllowedLocalAddress(InetAddress address) {
        if (address == null || address.isAnyLocalAddress() || address.isMulticastAddress()) {
            return false;
        }
        if (address.isLoopbackAddress() || address.isLinkLocalAddress()) {
            return true;
        }
        byte[] bytes = address.getAddress();
        if (address instanceof Inet4Address && bytes.length == 4) {
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            return first == 10
                    || (first == 172 && second >= 16 && second <= 31)
                    || (first == 192 && second == 168)
                    || (first == 100 && second >= 64 && second <= 127);
        }
        if (address instanceof Inet6Address && bytes.length == 16) {
            int first = bytes[0] & 0xff;
            return (first & 0xfe) == 0xfc;
        }
        return false;
    }

    private static boolean isValidTrustedOrigin(String origin) {
        return origin != null && !origin.isEmpty() && origin.length() <= MAX_URL_LENGTH;
    }

    private static boolean isValidRequestId(String requestId) {
        if (requestId == null || requestId.isEmpty() || requestId.length() > MAX_REQUEST_ID_LENGTH) {
            return false;
        }
        for (int index = 0; index < requestId.length(); index += 1) {
            char character = requestId.charAt(index);
            boolean allowed = character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9'
                    || character == '.'
                    || character == '_'
                    || character == '-'
                    || character == ':';
            if (!allowed) return false;
        }
        return true;
    }

    private static boolean isValidLastEventId(String lastEventId) {
        if (lastEventId == null || lastEventId.isEmpty()) {
            return true;
        }
        if (lastEventId.length() > MAX_LAST_EVENT_ID_LENGTH) {
            return false;
        }
        for (int index = 0; index < lastEventId.length(); index += 1) {
            char character = lastEventId.charAt(index);
            if (character == '\r' || character == '\n' || character == '\u0000') return false;
        }
        return true;
    }

    private static boolean isAsciiDigits(String value) {
        if (value == null || value.isEmpty()) return false;
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (character < '0' || character > '9') return false;
        }
        return true;
    }

    private static String safeContentType(String contentType) {
        if (contentType == null) return "";
        return contentType.length() <= 256 ? contentType : contentType.substring(0, 256);
    }

    private static JSONObject responseDetail(
            String requestId,
            boolean ok,
            int status,
            String body,
            String contentType,
            JSONObject error
    ) {
        JSONObject detail = new JSONObject();
        try {
            detail.put("requestId", requestId);
            detail.put("ok", ok);
            detail.put("status", status);
            detail.put("body", body == null ? "" : body);
            detail.put("contentType", contentType == null ? "" : contentType);
            detail.put("error", error == null ? JSONObject.NULL : error);
        } catch (JSONException impossible) {
            // All inserted values are finite primitives or strings.
        }
        return detail;
    }

    private static JSONObject streamOpenDetail(String requestId, int status, String contentType) {
        JSONObject detail = streamTypeDetail(requestId, "open");
        try {
            detail.put("status", status);
            detail.put("contentType", contentType == null ? "" : contentType);
        } catch (JSONException impossible) {
            // All inserted values are finite primitives or strings.
        }
        return detail;
    }

    private static JSONObject streamTypeDetail(String requestId, String type) {
        JSONObject detail = new JSONObject();
        try {
            detail.put("requestId", requestId);
            detail.put("type", type);
        } catch (JSONException impossible) {
            // All inserted values are strings.
        }
        return detail;
    }

    private static JSONObject streamErrorDetail(String requestId, int status, String code, String message) {
        JSONObject detail = streamTypeDetail(requestId, "error");
        try {
            detail.put("status", status);
            detail.put("error", errorObject(code, message));
        } catch (JSONException impossible) {
            // All inserted values are finite primitives or JSON objects.
        }
        return detail;
    }

    private static JSONObject errorObject(String code, String message) {
        JSONObject error = new JSONObject();
        try {
            error.put("code", code);
            error.put("message", message);
        } catch (JSONException impossible) {
            // All inserted values are strings.
        }
        return error;
    }

    private static void closeQuietly(Closeable closeable) {
        if (closeable == null) return;
        try {
            closeable.close();
        } catch (IOException ignored) {
            // Cleanup only. Never log network details or headers.
        }
    }

    private final class ActiveCall {
        private final PreparedRequest request;
        private final boolean stream;
        private final AtomicBoolean cancelled = new AtomicBoolean(false);
        private final AtomicBoolean terminal = new AtomicBoolean(false);
        private volatile Future<?> future;
        private volatile HttpURLConnection connection;
        private volatile InputStream input;

        private ActiveCall(PreparedRequest request, boolean stream) {
            this.request = request;
            this.stream = stream;
        }

        private void attachFuture(Future<?> nextFuture) {
            future = nextFuture;
            if (cancelled.get()) nextFuture.cancel(true);
        }

        private void attachConnection(HttpURLConnection nextConnection) {
            connection = nextConnection;
            if (cancelled.get()) nextConnection.disconnect();
        }

        private void attachInput(InputStream nextInput) {
            input = nextInput;
            if (cancelled.get()) closeQuietly(nextInput);
        }

        private boolean isCancelled() {
            return cancelled.get() || Thread.currentThread().isInterrupted();
        }

        private boolean cancel(boolean notify) {
            if (!terminal.compareAndSet(false, true)) {
                return false;
            }
            cancelled.set(true);
            closeResources();
            Future<?> currentFuture = future;
            if (currentFuture != null) currentFuture.cancel(true);
            if (notify) {
                if (stream) {
                    eventSink.dispatch(STREAM_EVENT, request.trustedOrigin, streamTypeDetail(request.requestId, "cancelled"));
                } else {
                    eventSink.dispatch(RESPONSE_EVENT, request.trustedOrigin, responseDetail(
                            request.requestId,
                            false,
                            0,
                            "",
                            "",
                            errorObject("cancelled", "Bridge request was cancelled.")
                    ));
                }
            }
            return true;
        }

        private void finishResponse(JSONObject detail) {
            if (!cancelled.get() && terminal.compareAndSet(false, true)) {
                eventSink.dispatch(RESPONSE_EVENT, request.trustedOrigin, detail);
            }
        }

        private void failResponse(int status, String code, String message) {
            finishResponse(responseDetail(
                    request.requestId,
                    false,
                    status,
                    "",
                    "",
                    errorObject(code, message)
            ));
        }

        private void dispatchStream(JSONObject detail, boolean terminalEvent) {
            if (cancelled.get()) return;
            if (terminalEvent) {
                if (!terminal.compareAndSet(false, true)) return;
            } else if (terminal.get()) {
                return;
            }
            eventSink.dispatch(STREAM_EVENT, request.trustedOrigin, detail);
        }

        private void failStream(int status, String code, String message) {
            dispatchStream(streamErrorDetail(request.requestId, status, code, message), true);
        }

        private void closeResources() {
            closeQuietly(input);
            input = null;
            HttpURLConnection currentConnection = connection;
            connection = null;
            if (currentConnection != null) currentConnection.disconnect();
        }
    }

    private static final class PreparedRequest {
        private final String trustedOrigin;
        private final String requestId;
        private final URI uri;
        private final String method;
        private final byte[] body;
        private final String token;
        private final String lastEventId;

        private PreparedRequest(
                String trustedOrigin,
                String requestId,
                URI uri,
                String method,
                byte[] body,
                String token,
                String lastEventId
        ) {
            this.trustedOrigin = trustedOrigin;
            this.requestId = requestId;
            this.uri = uri;
            this.method = method;
            this.body = body;
            this.token = token;
            this.lastEventId = lastEventId;
        }
    }

    private static final class ResponseTooLargeException extends IOException {
        private static final long serialVersionUID = 1L;
    }

    private static final class PairingTokenException extends Exception {
        private static final long serialVersionUID = 1L;
        private final String code;

        private PairingTokenException(String code, String message) {
            super(message);
            this.code = code;
        }
    }

    private static final class EmptyInputStream extends InputStream {
        @Override
        public int read() {
            return -1;
        }
    }
}
