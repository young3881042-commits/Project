package com.platform.aiassitant;

import java.util.Arrays;
import java.util.Collections;

public final class FinanceNotificationParserStaticTest {
    private FinanceNotificationParserStaticTest() {}

    public static void main(String[] args) {
        long occurredAt = 1_750_000_000_000L;
        FinanceNotificationParser.Candidate coffee = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "0|com.samsung.android.spay|payment-1",
                occurredAt,
                Arrays.asList("삼성월렛", "스타벅스 4,500원 결제 승인")
        );
        require(coffee != null);
        require(coffee.amount == 4_500L);
        require("스타벅스".equals(coffee.merchant));
        require(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE.equals(coffee.source));
        require(coffee.eventId.matches("fn-[0-9a-f]{64}"));
        require(!coffee.fallbackMerchant);

        FinanceNotificationParser.Candidate numberedMerchant = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "payment-2",
                occurredAt + 1L,
                Collections.singletonList("GS25 3,200원 카드사용 승인")
        );
        require(numberedMerchant != null);
        require("GS25".equals(numberedMerchant.merchant));

        FinanceNotificationParser.Candidate protectedNumber = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "payment-3",
                occurredAt + 2L,
                Collections.singletonList("카드 12345678 스타벅스 5,000원 결제")
        );
        require(protectedNumber != null);
        require("스타벅스".equals(protectedNumber.merchant));
        require(!protectedNumber.merchant.contains("12345678"));

        FinanceNotificationParser.Candidate separatedAccount =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                        "payment-account",
                        occurredAt + 2L,
                        Collections.singletonList(
                                "계좌 123-456-78 스타벅스 5,000원 결제"
                        )
                );
        require(separatedAccount != null);
        require("스타벅스".equals(separatedAccount.merchant));

        FinanceNotificationParser.Candidate fallback = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "payment-4",
                occurredAt + 3L,
                Collections.singletonList("삼성월렛 결제 승인되었습니다 7,000원")
        );
        require(fallback != null);
        require(fallback.fallbackMerchant);
        require(FinanceNotificationParser.SAMSUNG_WALLET_FALLBACK_MERCHANT.equals(
                fallback.merchant
        ));

        FinanceNotificationParser.Candidate duplicateAmountText =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                        "payment-5",
                        occurredAt + 4L,
                        Arrays.asList(
                                "쿠팡 12,000원 결제",
                                "쿠팡 12,000원 결제 승인"
                        )
                );
        require(duplicateAmountText != null);
        require(duplicateAmountText.amount == 12_000L);

        require(FinanceNotificationParser.parse(
                "com.example.wallet",
                "unsupported-1",
                occurredAt,
                Collections.singletonList("스타벅스 4,500원 결제")
        ) == null);
        for (String rejected : new String[]{
                "4,500원 결제 취소",
                "4,500원 환불 완료",
                "4,500원 승인 거절",
                "4,500원 결제 실패",
                "4,500원 결제 혜택 광고",
                "4,500원 출금",
                "4,500원 입금",
                "4,500원 송금",
                "4,500원 계좌이체",
                "ATM 4,500원 현금 인출"
        }) {
            require(FinanceNotificationParser.parse(
                    FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                    "rejected-" + rejected.hashCode(),
                    occurredAt,
                    Collections.singletonList(rejected)
            ) == null);
        }

        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "multiple-amounts",
                occurredAt,
                Collections.singletonList("스타벅스 10,000원 결제 잔액 90,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "missing-currency",
                occurredAt,
                Collections.singletonList("스타벅스 10000 결제")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "malformed-amount",
                occurredAt,
                Collections.singletonList("스타벅스 12,34원 결제")
        ) == null);

        FinanceNotificationParser.Candidate sameEvent = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "stable-key",
                occurredAt,
                Collections.singletonList("스타벅스 4,500원 결제")
        );
        FinanceNotificationParser.Candidate reusedKeyLater = FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "stable-key",
                occurredAt + 1_000L,
                Collections.singletonList("스타벅스 4,500원 결제")
        );
        require(sameEvent != null && reusedKeyLater != null);
        require(coffee.eventId.equals(FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "0|com.samsung.android.spay|payment-1",
                occurredAt,
                Arrays.asList("삼성월렛", "스타벅스 4,500원 결제 승인")
        ).eventId));
        require(!sameEvent.eventId.equals(reusedKeyLater.eventId));
    }

    private static void require(boolean condition) {
        if (!condition) {
            throw new AssertionError("Finance notification parser invariant failed");
        }
    }
}
