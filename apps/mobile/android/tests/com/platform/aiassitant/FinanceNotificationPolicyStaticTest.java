package com.platform.aiassitant;

import java.util.ArrayList;
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

        require(Boolean.TRUE.equals(FinanceNotificationPolicy.selectedSourceEnabled(
                "[\"samsung-wallet\"]"
        )));
        require(Boolean.TRUE.equals(FinanceNotificationPolicy.selectedSourceEnabled(
                "[  \"samsung-wallet\"  ]"
        )));
        require(Boolean.FALSE.equals(FinanceNotificationPolicy.selectedSourceEnabled("[]")));
        require(FinanceNotificationPolicy.selectedSourceEnabled(
                "[\"samsung-wallet\",\"other-wallet\"]"
        ) == null);
        require(FinanceNotificationPolicy.selectedSourceEnabled(
                "[\"com.samsung.android.spay\"]"
        ) == null);
        require(FinanceNotificationPolicy.selectedSourceEnabled(
                "[\"samsung -wallet\"]"
        ) == null);

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

        require(FinanceNotificationPolicy.isValidCandidate(candidate(900, "GS25")));
        require(!FinanceNotificationPolicy.isValidCandidate(candidate(901, "카드12345678")));
        require(FinanceNotificationPolicy.MAX_SEEN_EVENT_IDS
                >= FinanceNotificationPolicy.MAX_PENDING_TRANSACTIONS);
    }

    private static FinanceNotificationParser.Candidate candidate(int index, String merchant) {
        return new FinanceNotificationParser.Candidate(
                eventId(index),
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE,
                1_000L + index,
                merchant,
                1_750_000_000_000L + index,
                false
        );
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
