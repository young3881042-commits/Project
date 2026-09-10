package com.platform.aiassitant;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

final class FinanceNotificationPolicy {
    static final int MAX_PENDING_TRANSACTIONS = 256;
    static final int MAX_SEEN_EVENT_IDS = 512;
    static final int MAX_IMPORT_BATCH = 128;

    private static final Pattern OWNER_PATTERN = Pattern.compile("[a-z0-9._-]{1,128}");
    private static final Pattern REQUEST_ID_PATTERN = Pattern.compile("[A-Za-z0-9._:-]{1,128}");
    private static final Pattern EVENT_ID_PATTERN = Pattern.compile("fn-[0-9a-f]{64}");

    private FinanceNotificationPolicy() {}

    static boolean isValidOwner(String owner) {
        return owner != null && OWNER_PATTERN.matcher(owner).matches();
    }

    static boolean isValidRequestId(String requestId) {
        return requestId != null && REQUEST_ID_PATTERN.matcher(requestId).matches();
    }

    static boolean isValidEventId(String eventId) {
        return eventId != null && EVENT_ID_PATTERN.matcher(eventId).matches();
    }

    static boolean isValidDecisionStatus(String status) {
        return "saved".equals(status)
                || "duplicate".equals(status);
    }

    static LinkedHashSet<String> selectedSources(String sourcesJson) {
        if (sourcesJson == null || sourcesJson.length() > 128) {
            return null;
        }
        LinkedHashSet<String> parsed = new JsonStringArrayParser(sourcesJson).parse();
        if (parsed == null
                || parsed.size() > FinanceNotificationParser.supportedSources().size()) {
            return null;
        }
        LinkedHashSet<String> canonical = FinanceNotificationParser.supportedSources();
        canonical.retainAll(parsed);
        return canonical.size() == parsed.size() ? canonical : null;
    }

    static Boolean selectedSourceEnabled(String sourcesJson) {
        LinkedHashSet<String> selected = selectedSources(sourcesJson);
        if (selected == null) {
            return null;
        }
        return !selected.isEmpty();
    }

    static String ownerHash(String owner) {
        if (!isValidOwner(owner)) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(
                    ("orbit-finance-owner-v2\u0000" + owner)
                            .getBytes(StandardCharsets.UTF_8)
            );
            StringBuilder encoded = new StringBuilder();
            for (byte item : hashed) {
                encoded.append(String.format(Locale.US, "%02x", item & 0xff));
            }
            return encoded.toString();
        } catch (NoSuchAlgorithmException unavailable) {
            return null;
        }
    }

    static boolean containsEventId(
            List<FinanceNotificationParser.Candidate> candidates,
            String eventId
    ) {
        if (candidates == null || !isValidEventId(eventId)) {
            return false;
        }
        for (FinanceNotificationParser.Candidate candidate : candidates) {
            if (candidate != null && eventId.equals(candidate.eventId)) {
                return true;
            }
        }
        return false;
    }

    static boolean appendBounded(
            List<FinanceNotificationParser.Candidate> candidates,
            FinanceNotificationParser.Candidate candidate
    ) {
        if (candidates == null
                || !isValidCandidate(candidate)
                || containsEventId(candidates, candidate.eventId)) {
            return false;
        }
        candidates.add(candidate);
        while (candidates.size() > MAX_PENDING_TRANSACTIONS) {
            candidates.remove(0);
        }
        return true;
    }

    static boolean isValidCandidate(FinanceNotificationParser.Candidate candidate) {
        return candidate != null
                && isValidEventId(candidate.eventId)
                && FinanceNotificationParser.isSupportedSource(candidate.source)
                && !((FinanceNotificationParser.KAKAO_PAY_SOURCE.equals(candidate.source)
                        || FinanceNotificationParser.TOSS_SOURCE.equals(candidate.source))
                        && candidate.fallbackMerchant)
                && candidate.amount > 0L
                && candidate.amount <= 999_999_999L
                && candidate.merchant != null
                && candidate.merchant.length() >= 2
                && candidate.merchant.length() <= 80
                && !candidate.merchant.matches(
                        ".*(잔액|계좌|카드번호|승인번호|거래번호).*"
                )
                && !hasSensitiveMerchantNumber(candidate.merchant)
                && candidate.occurredAt > 0L;
    }

    private static final class JsonStringArrayParser {
        private final String value;
        private int index;

        JsonStringArrayParser(String value) {
            this.value = value;
        }

        LinkedHashSet<String> parse() {
            LinkedHashSet<String> values = new LinkedHashSet<>();
            skipWhitespace();
            if (!consume('[')) {
                return null;
            }
            skipWhitespace();
            if (consume(']')) {
                skipWhitespace();
                return index == value.length() ? values : null;
            }
            while (index < value.length()) {
                String item = stringValue();
                if (item == null
                        || !FinanceNotificationParser.isSupportedSource(item)
                        || !values.add(item)
                        || values.size()
                                > FinanceNotificationParser.supportedSources().size()) {
                    return null;
                }
                skipWhitespace();
                if (consume(']')) {
                    skipWhitespace();
                    return index == value.length() ? values : null;
                }
                if (!consume(',')) {
                    return null;
                }
                skipWhitespace();
                if (index >= value.length() || value.charAt(index) == ']') {
                    return null;
                }
            }
            return null;
        }

        private String stringValue() {
            if (!consume('\"')) {
                return null;
            }
            StringBuilder decoded = new StringBuilder();
            while (index < value.length()) {
                char character = value.charAt(index++);
                if (character == '\"') {
                    return decoded.toString();
                }
                if (character < 0x20) {
                    return null;
                }
                if (character != '\\') {
                    decoded.append(character);
                    continue;
                }
                if (index >= value.length()) {
                    return null;
                }
                char escaped = value.charAt(index++);
                switch (escaped) {
                    case '\"':
                    case '\\':
                    case '/':
                        decoded.append(escaped);
                        break;
                    case 'b':
                        decoded.append('\b');
                        break;
                    case 'f':
                        decoded.append('\f');
                        break;
                    case 'n':
                        decoded.append('\n');
                        break;
                    case 'r':
                        decoded.append('\r');
                        break;
                    case 't':
                        decoded.append('\t');
                        break;
                    case 'u':
                        Character unicode = unicodeCharacter();
                        if (unicode == null) {
                            return null;
                        }
                        decoded.append(unicode);
                        break;
                    default:
                        return null;
                }
            }
            return null;
        }

        private Character unicodeCharacter() {
            if (index + 4 > value.length()) {
                return null;
            }
            int decoded = 0;
            for (int offset = 0; offset < 4; offset += 1) {
                int digit = Character.digit(value.charAt(index + offset), 16);
                if (digit < 0) {
                    return null;
                }
                decoded = decoded * 16 + digit;
            }
            index += 4;
            return (char) decoded;
        }

        private boolean consume(char expected) {
            if (index >= value.length() || value.charAt(index) != expected) {
                return false;
            }
            index += 1;
            return true;
        }

        private void skipWhitespace() {
            while (index < value.length()) {
                char character = value.charAt(index);
                if (character != ' '
                        && character != '\t'
                        && character != '\n'
                        && character != '\r') {
                    return;
                }
                index += 1;
            }
        }
    }

    private static boolean hasSensitiveMerchantNumber(String value) {
        if (value.matches(".*[0-9０-９]{4,}.*")
                || value.matches(
                        ".*(?:[*#xX•·-]{2,}[0-9０-９]{2,}"
                                + "|[0-9０-９]{2,}[*#xX•·-]{2,}).*"
                )) {
            return true;
        }
        int digitCount = 0;
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if ((character >= '0' && character <= '9')
                    || (character >= '０' && character <= '９')) {
                digitCount += 1;
                if (digitCount >= 8) {
                    return true;
                }
            }
        }
        return false;
    }
}
