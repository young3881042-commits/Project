package com.platform.aiassitant;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

final class FinanceNotificationPolicy {
    static final int MAX_PENDING_TRANSACTIONS = 256;
    static final int MAX_SEEN_EVENT_IDS = 512;
    static final int MAX_BRIDGE_BATCH = 128;

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

    static Boolean selectedSourceEnabled(String sourcesJson) {
        if (sourcesJson == null || sourcesJson.length() > 128) {
            return null;
        }
        if (sourcesJson.matches("\\[\\s*\\]")) {
            return Boolean.FALSE;
        }
        if (sourcesJson.matches(
                "\\[\\s*\""
                        + FinanceNotificationParser.SAMSUNG_WALLET_SOURCE
                        + "\"\\s*\\]"
        )) {
            return Boolean.TRUE;
        }
        return null;
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
                && FinanceNotificationParser.SAMSUNG_WALLET_SOURCE.equals(candidate.source)
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
