package com.platform.aiassitant;

import java.net.InetAddress;
import java.net.URI;

/** Small JVM smoke test for security-critical validation that does not need an emulator. */
public final class BridgeHttpProxyStaticTest {
    private BridgeHttpProxyStaticTest() {
    }

    public static void main(String[] args) throws Exception {
        assertPresent(BridgeHttpProxy.parseBridgeUri("http://192.168.10.12:4317/api/health"));
        assertPresent(BridgeHttpProxy.parseBridgeUri(
                "https://pc.example.test/api/threads/thread-1/events?after=42"
        ));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://user:pass@192.168.1.2/api/health"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/api/health#secret"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/not-api/health"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/api/../secret"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/api/%2e%2e/secret"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/api/%252e%252e/secret"));
        assertMissing(BridgeHttpProxy.parseBridgeUri("http://192.168.1.2/api%2fsecret"));

        URI foodAnalyze = BridgeHttpProxy.parseBridgeUri(
                "https://pc.example.test/api/food/analyze"
        );
        assertEquals(2_359_296, BridgeHttpProxy.requestBodyLimitBytes(foodAnalyze, "POST"));
        assertEquals(90_000, BridgeHttpProxy.requestReadTimeoutMillis(foodAnalyze, "POST"));
        assertEquals(65_536, BridgeHttpProxy.requestBodyLimitBytes(foodAnalyze, "GET"));
        assertEquals(30_000, BridgeHttpProxy.requestReadTimeoutMillis(foodAnalyze, "GET"));
        URI foodAnalyzeChild = BridgeHttpProxy.parseBridgeUri(
                "https://pc.example.test/api/food/analyze/extra"
        );
        assertEquals(65_536, BridgeHttpProxy.requestBodyLimitBytes(foodAnalyzeChild, "POST"));
        assertEquals(30_000, BridgeHttpProxy.requestReadTimeoutMillis(foodAnalyzeChild, "POST"));
        URI otherPost = BridgeHttpProxy.parseBridgeUri(
                "https://pc.example.test/api/threads"
        );
        assertEquals(65_536, BridgeHttpProxy.requestBodyLimitBytes(otherPost, "POST"));
        assertEquals(30_000, BridgeHttpProxy.requestReadTimeoutMillis(otherPost, "POST"));

        assertAllowed("127.0.0.1");
        assertAllowed("192.168.1.10");
        assertAllowed("172.16.2.4");
        assertAllowed("10.12.0.3");
        assertAllowed("100.64.0.1");
        assertAllowed("::1");
        assertAllowed("fc00::1");
        assertAllowed("fe80::1");
        assertBlocked("0.0.0.0");
        assertBlocked("::");
        assertBlocked("8.8.8.8");
        assertBlocked("100.128.0.1");
        assertBlocked("2001:4860:4860::8888");

        URI endpoint = BridgeHttpProxy.parseBridgeUri("HTTPS://PC.EXAMPLE.TEST/api/health");
        assertEquals("https://pc.example.test:443", BridgeHttpProxy.bridgeOrigin(endpoint));
        assertEquals(
                "http://192.168.1.2:4317",
                SecureTokenStore.normalizeBridgeOrigin("http://192.168.1.2:4317/")
        );
        assertMissing(SecureTokenStore.normalizeBridgeOrigin("http://192.168.1.2:4317/app"));
        assertMissing(SecureTokenStore.normalizeBridgeOrigin("http://user@192.168.1.2:4317"));
        if (!SecureTokenStore.isAllowedTokenKey("lifehub.bridge.token:pc-01")) {
            throw new AssertionError("valid token key was rejected");
        }
        if (SecureTokenStore.isAllowedTokenKey("lifehub.bridge.token:../pc")) {
            throw new AssertionError("invalid token key was accepted");
        }

        assertTrue(ImageFileChooserPolicy.acceptsRequestedTypes(new String[]{"image/*"}));
        assertTrue(ImageFileChooserPolicy.acceptsRequestedTypes(
                new String[]{"image/jpeg,image/png", "image/webp"}
        ));
        assertFalse(ImageFileChooserPolicy.acceptsRequestedTypes(new String[]{"image/gif"}));
        assertFalse(ImageFileChooserPolicy.acceptsRequestedTypes(
                new String[]{"image/jpeg", "video/mp4"}
        ));
        assertTrue(ImageFileChooserPolicy.isAllowedFileSize(-1));
        assertTrue(ImageFileChooserPolicy.isAllowedFileSize(20L * 1024L * 1024L));
        assertFalse(ImageFileChooserPolicy.isAllowedFileSize(20L * 1024L * 1024L + 1L));
        assertTrue(ImageFileChooserPolicy.isAllowedDimensions(1, 1));
        assertTrue(ImageFileChooserPolicy.isAllowedDimensions(16_384, 1));
        assertTrue(ImageFileChooserPolicy.isAllowedDimensions(8_000, 5_000));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(0, 100));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(100, -1));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(16_385, 1));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(1, 16_385));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(8_000, 5_001));
        assertFalse(ImageFileChooserPolicy.isAllowedDimensions(16_384, 16_384));
        assertTrue(ImageFileChooserPolicy.matchesSignature(
                "image/jpeg",
                new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff},
                3
        ));
        assertTrue(ImageFileChooserPolicy.matchesSignature(
                "image/png",
                new byte[]{
                        (byte) 0x89, 0x50, 0x4e, 0x47,
                        0x0d, 0x0a, 0x1a, 0x0a
                },
                8
        ));
        assertTrue(ImageFileChooserPolicy.matchesSignature(
                "image/webp",
                new byte[]{
                        'R', 'I', 'F', 'F', 0, 0, 0, 0,
                        'W', 'E', 'B', 'P'
                },
                12
        ));
        assertFalse(ImageFileChooserPolicy.matchesSignature(
                "image/png",
                new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff},
                3
        ));
    }

    private static void assertAllowed(String address) throws Exception {
        if (!BridgeHttpProxy.isAllowedLocalAddress(InetAddress.getByName(address))) {
            throw new AssertionError("expected local address: " + address);
        }
    }

    private static void assertBlocked(String address) throws Exception {
        if (BridgeHttpProxy.isAllowedLocalAddress(InetAddress.getByName(address))) {
            throw new AssertionError("expected blocked address: " + address);
        }
    }

    private static void assertPresent(Object value) {
        if (value == null) throw new AssertionError("expected a value");
    }

    private static void assertMissing(Object value) {
        if (value != null) throw new AssertionError("expected no value: " + value);
    }

    private static void assertEquals(Object expected, Object actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("expected " + expected + " but was " + actual);
        }
    }

    private static void assertTrue(boolean value) {
        if (!value) throw new AssertionError("expected true");
    }

    private static void assertFalse(boolean value) {
        if (value) throw new AssertionError("expected false");
    }
}
