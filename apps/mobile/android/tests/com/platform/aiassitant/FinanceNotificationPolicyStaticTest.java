package com.platform.aiassitant;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

public final class FinanceNotificationPolicyStaticTest {
    private FinanceNotificationPolicyStaticTest() {}

    public static void main(String[] args) {
        require(FinanceNotificationPolicy.isValidOwner("guestuser"));
        require(FinanceNotificationPolicy.isValidOwner("user.name_01"));
        require(!FinanceNotificationPolicy.isValidOwner("UserName"));
        require(!FinanceNotificationPolicy.isValidOwner("../owner"));
        require(!FinanceNotificationPolicy.isValidOwner("owner name"));
        require(!FinanceNotificationPolicy.isValidOwner(""));

        String ownerHash = FinanceNotificationPolicy.ownerHash("guestuser");
        require(ownerHash != null && ownerHash.matches("[0-9a-f]{64}"));
        require(ownerHash.equals(FinanceNotificationPolicy.ownerHash("guestuser")));
        require(!ownerHash.contains("guestuser"));
        require(!ownerHash.equals(FinanceNotificationPolicy.ownerHash("another-user")));

        requireSources("[]");
        requireSources("[\"samsung-wallet\"]", "samsung-wallet");
        requireSources("[  \"kakao-pay\"  ]", "kakao-pay");
        requireSources(
                "[\n\"kakao-pay\",\t\"samsung-wallet\"\r]",
                "samsung-wallet",
                "kakao-pay"
        );
        requireSources("[\"kakao\\u002dpay\"]", "kakao-pay");
        require(Boolean.TRUE.equals(FinanceNotificationPolicy.selectedSourceEnabled(
                "[\"samsung-wallet\",\"kakao-pay\"]"
        )));
        require(Boolean.FALSE.equals(FinanceNotificationPolicy.selectedSourceEnabled("[]")));
        for (String rejectedSources : new String[]{
                null,
                "",
                "samsung-wallet",
                "[\"samsung-wallet\",\"samsung-wallet\"]",
                "[\"samsung-wallet\",\"other-wallet\"]",
                "[\"samsung-wallet\",\"mobile-tmoney\"]",
                "[\"com.samsung.android.spay\"]",
                "[\"com.kakaopay.app\"]",
                "[\"samsung -wallet\"]",
                "[true]",
                "[1]",
                "[null]",
                "[{}]",
                "[\"samsung-wallet\",]",
                "[,\"samsung-wallet\"]",
                "[\"samsung-wallet\" \"kakao-pay\"]",
                "[\"samsung-wallet\"] trailing",
                "['samsung-wallet']",
                "[\"samsung-wallet\\x\"]",
                "[\"samsung-wallet]"
        }) {
            require(FinanceNotificationPolicy.selectedSources(rejectedSources) == null);
            require(FinanceNotificationPolicy.selectedSourceEnabled(rejectedSources) == null);
        }

        require(FinanceNotificationPolicy.isValidRequestId("card-import:request-1"));
        require(!FinanceNotificationPolicy.isValidRequestId("card import request"));
        require(FinanceNotificationPolicy.isValidDecisionStatus("saved"));
        require(FinanceNotificationPolicy.isValidDecisionStatus("duplicate"));
        require(!FinanceNotificationPolicy.isValidDecisionStatus("discarded"));

        List<FinanceNotificationParser.Candidate> pending = new ArrayList<>();
        for (int index = 0;
                index < FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS + 1;
                index += 1) {
            require(FinanceNotificationPolicy.appendBounded(
                    pending,
                    candidate(index, "상점")
            ));
        }
        require(pending.size() == FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS);
        require(!pending.get(0).eventId.equals(eventId(0)));
        FinanceNotificationParser.Candidate last = pending.get(pending.size() - 1);
        require(!FinanceNotificationPolicy.appendBounded(pending, last));
        require(pending.size() == FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS);

        require(FinanceNotificationPolicy.isValidCandidate(candidate(
                900,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                "GS25"
        )));
        require(FinanceNotificationPolicy.isValidCandidate(candidate(
                901,
                FinanceNotificationParser.KAKAO_PAY_SOURCE,
                "스타벅스"
        )));
        require(!FinanceNotificationPolicy.isValidCandidate(candidate(
                902,
                "mobile-tmoney",
                "버스"
        )));
        require(!FinanceNotificationPolicy.isValidCandidate(candidate(
                903,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                "카드12345678"
        )));
        require(FinanceNotificationPolicy.MAX_SEEN_EVENT_IDS
                >= FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS);
    }

    private static FinanceNotificationParser.Candidate candidate(int index, String merchant) {
        return candidate(
                index,
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                merchant
        );
    }

    private static FinanceNotificationParser.Candidate candidate(
            int index,
            String source,
            String merchant
    ) {
        return new FinanceNotificationParser.Candidate(
                eventId(index),
                source,
                1_000L + index,
                merchant,
                1_750_000_000_000L + index,
                false
        );
    }

    private static void requireSources(String json, String... expected) {
        LinkedHashSet<String> selected = FinanceNotificationPolicy.selectedSources(json);
        require(selected != null);
        require(new ArrayList<>(selected).equals(Arrays.asList(expected)));
    }

    private static String eventId(int index) {
        return "fn-" + String.format("%064x", index + 1L);
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("Finance notification policy invariant failed");
        }
    }
}
