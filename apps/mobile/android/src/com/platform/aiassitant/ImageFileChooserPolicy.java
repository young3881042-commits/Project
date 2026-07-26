package com.platform.aiassitant;

import java.util.Locale;

/** Pure validation helpers for the WebView's image-only file chooser. */
final class ImageFileChooserPolicy {
    static final String MIME_JPEG = "image/jpeg";
    static final String MIME_PNG = "image/png";
    static final String MIME_WEBP = "image/webp";
    private static final long MAX_FILE_BYTES = 20L * 1024L * 1024L;
    private static final int MAX_DIMENSION_PIXELS = 16_384;
    private static final long MAX_TOTAL_PIXELS = 40_000_000L;

    private ImageFileChooserPolicy() {
    }

    static String[] allowedMimeTypes() {
        return new String[]{MIME_JPEG, MIME_PNG, MIME_WEBP};
    }

    static boolean acceptsRequestedTypes(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) {
            return true;
        }
        for (String rawValue : acceptTypes) {
            String[] values = rawValue == null ? new String[0] : rawValue.split(",");
            for (String value : values) {
                String normalized = value.trim().toLowerCase(Locale.US);
                if (normalized.isEmpty()) {
                    continue;
                }
                if (!"image/*".equals(normalized) && !isSupportedMimeType(normalized)) {
                    return false;
                }
            }
        }
        return true;
    }

    static boolean isSupportedMimeType(String mimeType) {
        if (mimeType == null) {
            return false;
        }
        String normalized = mimeType.trim().toLowerCase(Locale.US);
        return MIME_JPEG.equals(normalized)
                || MIME_PNG.equals(normalized)
                || MIME_WEBP.equals(normalized);
    }

    static boolean isAllowedFileSize(long bytes) {
        return bytes < 0 || bytes <= MAX_FILE_BYTES;
    }

    static boolean isAllowedDimensions(int width, int height) {
        return width > 0
                && height > 0
                && width <= MAX_DIMENSION_PIXELS
                && height <= MAX_DIMENSION_PIXELS
                && (long) width * (long) height <= MAX_TOTAL_PIXELS;
    }

    static boolean matchesSignature(String mimeType, byte[] header, int length) {
        if (!isSupportedMimeType(mimeType) || header == null || length < 0) {
            return false;
        }
        String normalizedMimeType = mimeType.trim().toLowerCase(Locale.US);
        int available = Math.min(length, header.length);
        if (MIME_JPEG.equals(normalizedMimeType)) {
            return available >= 3
                    && unsigned(header[0]) == 0xff
                    && unsigned(header[1]) == 0xd8
                    && unsigned(header[2]) == 0xff;
        }
        if (MIME_PNG.equals(normalizedMimeType)) {
            int[] signature = {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
            if (available < signature.length) {
                return false;
            }
            for (int index = 0; index < signature.length; index += 1) {
                if (unsigned(header[index]) != signature[index]) {
                    return false;
                }
            }
            return true;
        }
        return available >= 12
                && header[0] == 'R'
                && header[1] == 'I'
                && header[2] == 'F'
                && header[3] == 'F'
                && header[8] == 'W'
                && header[9] == 'E'
                && header[10] == 'B'
                && header[11] == 'P';
    }

    private static int unsigned(byte value) {
        return value & 0xff;
    }
}
