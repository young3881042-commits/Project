package com.platform.aiassitant;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Pure validation helpers for LifeHub JSON documents handled through Android's document UI. */
final class LifeHubBackupDocumentPolicy {
    static final String MIME_TYPE = "application/json";
    static final int MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
    static final int MAX_FILE_NAME_LENGTH = 128;
    static final String CACHE_FILE_PREFIX = "lifehub-backup-document-";

    private LifeHubBackupDocumentPolicy() {}

    static boolean hasAllowedMimeType(String value) {
        return value != null && MIME_TYPE.equals(value.trim().toLowerCase(Locale.US));
    }

    static boolean acceptsRequestedTypes(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) {
            return false;
        }
        boolean foundJsonType = false;
        for (String rawValue : acceptTypes) {
            String[] values = rawValue == null ? new String[0] : rawValue.split(",");
            for (String value : values) {
                String normalized = value.trim().toLowerCase(Locale.US);
                if (normalized.length() == 0) {
                    continue;
                }
                if (!(MIME_TYPE.equals(normalized) || ".json".equals(normalized))) {
                    return false;
                }
                foundJsonType = true;
            }
        }
        return foundJsonType;
    }

    static boolean isAllowedReportedLength(long length) {
        return length < 0L || length <= MAX_DOCUMENT_BYTES;
    }

    static boolean isWithinByteLimit(String value) {
        if (value == null) {
            return false;
        }
        int bytes = 0;
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (character <= 0x7f) {
                bytes += 1;
            } else if (character <= 0x7ff) {
                bytes += 2;
            } else if (Character.isHighSurrogate(character)
                    && index + 1 < value.length()
                    && Character.isLowSurrogate(value.charAt(index + 1))) {
                bytes += 4;
                index += 1;
            } else if (Character.isSurrogate(character)) {
                // StandardCharsets.UTF_8 replaces an unpaired UTF-16 surrogate with '?'.
                bytes += 1;
            } else {
                bytes += 3;
            }
            if (bytes > MAX_DOCUMENT_BYTES) {
                return false;
            }
        }
        return true;
    }

    static String normalizeFileName(String value) {
        if (value == null) {
            return null;
        }
        String clean = value.trim();
        if (clean.length() == 0) {
            return null;
        }
        for (int index = 0; index < clean.length(); index += 1) {
            char character = clean.charAt(index);
            int type = Character.getType(character);
            if (Character.isISOControl(character)
                    || type == Character.FORMAT
                    || type == Character.LINE_SEPARATOR
                    || type == Character.PARAGRAPH_SEPARATOR
                    || character == '/'
                    || character == '\\') {
                return null;
            }
        }
        if (!clean.toLowerCase(Locale.US).endsWith(".json")) {
            clean += ".json";
        }
        if (clean.length() > MAX_FILE_NAME_LENGTH
                || ".json".equalsIgnoreCase(clean)
                || "..json".equalsIgnoreCase(clean)) {
            return null;
        }
        return clean;
    }

    static boolean hasJsonObjectEnvelope(String value) {
        if (value == null) {
            return false;
        }
        String clean = value.trim();
        return clean.length() >= 2 && clean.charAt(0) == '{'
                && clean.charAt(clean.length() - 1) == '}';
    }

    static boolean isStrictJsonObject(String value) {
        return value != null && new StrictJsonParser(value).parseObjectDocument();
    }

    static String decodeUtf8(byte[] value) throws CharacterCodingException {
        if (value == null) {
            throw new CharacterCodingException();
        }
        CharBuffer decoded = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(value));
        String result = decoded.toString();
        if (result.length() > 0 && result.charAt(0) == '\ufeff') {
            return result.substring(1);
        }
        return result;
    }

    static boolean isManagedCacheFileName(String value) {
        if (value == null
                || !value.startsWith(CACHE_FILE_PREFIX)
                || !value.endsWith(".json")
                || value.length() > CACHE_FILE_PREFIX.length() + 80) {
            return false;
        }
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (!(character >= 'a' && character <= 'z'
                    || character >= 'A' && character <= 'Z'
                    || character >= '0' && character <= '9'
                    || character == '.'
                    || character == '_'
                    || character == '-')) {
                return false;
            }
        }
        return true;
    }

    private static final class StrictJsonParser {
        private static final int MAX_NESTING_DEPTH = 128;

        private final String source;
        private int index;

        private StrictJsonParser(String source) {
            this.source = source;
        }

        private boolean parseObjectDocument() {
            skipWhitespace();
            if (!parseObject(1)) {
                return false;
            }
            skipWhitespace();
            return index == source.length();
        }

        private boolean parseValue(int containerDepth) {
            skipWhitespace();
            if (index >= source.length()) {
                return false;
            }
            char character = source.charAt(index);
            if (character == '{') {
                return parseObject(containerDepth + 1);
            }
            if (character == '[') {
                return parseArray(containerDepth + 1);
            }
            if (character == '"') {
                return parseString();
            }
            if (character == 't') {
                return consumeLiteral("true");
            }
            if (character == 'f') {
                return consumeLiteral("false");
            }
            if (character == 'n') {
                return consumeLiteral("null");
            }
            return character == '-' || isDigit(character) ? parseNumber() : false;
        }

        private boolean parseObject(int depth) {
            if (depth > MAX_NESTING_DEPTH || !consume('{')) {
                return false;
            }
            skipWhitespace();
            if (consume('}')) {
                return true;
            }
            while (true) {
                if (!parseString()) {
                    return false;
                }
                skipWhitespace();
                if (!consume(':') || !parseValue(depth)) {
                    return false;
                }
                skipWhitespace();
                if (consume('}')) {
                    return true;
                }
                if (!consume(',')) {
                    return false;
                }
                skipWhitespace();
            }
        }

        private boolean parseArray(int depth) {
            if (depth > MAX_NESTING_DEPTH || !consume('[')) {
                return false;
            }
            skipWhitespace();
            if (consume(']')) {
                return true;
            }
            while (true) {
                if (!parseValue(depth)) {
                    return false;
                }
                skipWhitespace();
                if (consume(']')) {
                    return true;
                }
                if (!consume(',')) {
                    return false;
                }
                skipWhitespace();
            }
        }

        private boolean parseString() {
            if (!consume('"')) {
                return false;
            }
            while (index < source.length()) {
                char character = source.charAt(index++);
                if (character == '"') {
                    return true;
                }
                if (character < 0x20) {
                    return false;
                }
                if (Character.isHighSurrogate(character)) {
                    if (index >= source.length()
                            || !Character.isLowSurrogate(source.charAt(index))) {
                        return false;
                    }
                    index += 1;
                    continue;
                }
                if (Character.isLowSurrogate(character)) {
                    return false;
                }
                if (character != '\\') {
                    continue;
                }
                if (index >= source.length()) {
                    return false;
                }
                char escape = source.charAt(index++);
                if (escape == '"'
                        || escape == '\\'
                        || escape == '/'
                        || escape == 'b'
                        || escape == 'f'
                        || escape == 'n'
                        || escape == 'r'
                        || escape == 't') {
                    continue;
                }
                if (escape != 'u' || index + 4 > source.length()) {
                    return false;
                }
                for (int offset = 0; offset < 4; offset += 1) {
                    if (!isHexDigit(source.charAt(index + offset))) {
                        return false;
                    }
                }
                index += 4;
            }
            return false;
        }

        private boolean parseNumber() {
            if (consume('-') && index >= source.length()) {
                return false;
            }
            if (consume('0')) {
                if (index < source.length() && isDigit(source.charAt(index))) {
                    return false;
                }
            } else {
                if (index >= source.length() || !isNonZeroDigit(source.charAt(index))) {
                    return false;
                }
                do {
                    index += 1;
                } while (index < source.length() && isDigit(source.charAt(index)));
            }
            if (consume('.')) {
                if (index >= source.length() || !isDigit(source.charAt(index))) {
                    return false;
                }
                do {
                    index += 1;
                } while (index < source.length() && isDigit(source.charAt(index)));
            }
            if (index < source.length()
                    && (source.charAt(index) == 'e' || source.charAt(index) == 'E')) {
                index += 1;
                if (index < source.length()
                        && (source.charAt(index) == '+' || source.charAt(index) == '-')) {
                    index += 1;
                }
                if (index >= source.length() || !isDigit(source.charAt(index))) {
                    return false;
                }
                do {
                    index += 1;
                } while (index < source.length() && isDigit(source.charAt(index)));
            }
            return true;
        }

        private boolean consumeLiteral(String literal) {
            if (!source.regionMatches(index, literal, 0, literal.length())) {
                return false;
            }
            index += literal.length();
            return true;
        }

        private boolean consume(char expected) {
            if (index >= source.length() || source.charAt(index) != expected) {
                return false;
            }
            index += 1;
            return true;
        }

        private void skipWhitespace() {
            while (index < source.length()) {
                char character = source.charAt(index);
                if (!(character == ' '
                        || character == '\t'
                        || character == '\r'
                        || character == '\n')) {
                    return;
                }
                index += 1;
            }
        }

        private static boolean isDigit(char value) {
            return value >= '0' && value <= '9';
        }

        private static boolean isNonZeroDigit(char value) {
            return value >= '1' && value <= '9';
        }

        private static boolean isHexDigit(char value) {
            return isDigit(value)
                    || value >= 'a' && value <= 'f'
                    || value >= 'A' && value <= 'F';
        }
    }
}
