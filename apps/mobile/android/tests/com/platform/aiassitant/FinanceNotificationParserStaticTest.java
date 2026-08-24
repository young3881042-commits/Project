package com.platform.aiassitant;

import java.util.Arrays;
import java.util.Collections;

public final class FinanceNotificationParserStaticTest {
    private FinanceNotificationParserStaticTest() {}

    public static void main(String[] args) {
        long occurredAt = 1_750_000_000_000L;
        require(FinanceNotificationParser.isSupportedPackage(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE
        ));
        require(FinanceNotificationParser.isSupportedPackage(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE
        ));
        require(FinanceNotificationParser.SAMSUNG_WALLET_SOURCE.equals(
                FinanceNotificationParser.sourceForPackage(
                        FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE
                )
        ));
        require(FinanceNotificationParser.KAKAO_PAY_SOURCE.equals(
                FinanceNotificationParser.sourceForPackage(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE
                )
        ));
        require(FinanceNotificationParser.sourceForPackage("com.kakao.talk") == null);
        require(FinanceNotificationParser.sourceForPackage("com.lgt.tmoney") == null);
        require(FinanceNotificationParser.sourceForPackage("kr.co.tmoney.tia") == null);
        require(!FinanceNotificationParser.isSupportedPackage("com.kakaopay.app.fake"));
        require("삼성페이".equals(FinanceNotificationParser.labelForSource(
                FinanceNotificationParser.SAMSUNG_WALLET_SOURCE
        )));
        require("카카오페이".equals(FinanceNotificationParser.labelForSource(
                FinanceNotificationParser.KAKAO_PAY_SOURCE
        )));
        require(FinanceNotificationParser.labelForSource("unknown") == null);

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

        FinanceNotificationParser.Candidate kakaoCoffee =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "0|com.kakaopay.app|payment-1",
                        occurredAt + 5L,
                        Arrays.asList("카카오페이", "스타벅스 6,500원 결제 완료")
                );
        require(kakaoCoffee != null);
        require(kakaoCoffee.amount == 6_500L);
        require("스타벅스".equals(kakaoCoffee.merchant));
        require(FinanceNotificationParser.KAKAO_PAY_SOURCE.equals(kakaoCoffee.source));
        require(!kakaoCoffee.fallbackMerchant);

        FinanceNotificationParser.Candidate kakaoLabeledMerchant =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "kakao-labeled-merchant",
                        occurredAt + 5L,
                        Arrays.asList(
                                "카카오페이 결제완료",
                                "가맹점명: 올리브영",
                                "결제금액 32,000원"
                        )
                );
        require(kakaoLabeledMerchant != null);
        require(kakaoLabeledMerchant.amount == 32_000L);
        require("올리브영".equals(kakaoLabeledMerchant.merchant));
        require(FinanceNotificationParser.KAKAO_PAY_SOURCE.equals(
                kakaoLabeledMerchant.source
        ));

        FinanceNotificationParser.Candidate kakaoPurchase =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "kakao-purchase",
                        occurredAt + 6L,
                        Collections.singletonList("온라인상점 ￦18,900 결제 완료")
                );
        require(kakaoPurchase != null);
        require(kakaoPurchase.amount == 18_900L);
        require("온라인상점".equals(kakaoPurchase.merchant));

        FinanceNotificationParser.Candidate kakaoCompact =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "kakao-compact",
                        occurredAt + 6L,
                        Arrays.asList("결제", "스타벅스 | 6,500원")
                );
        require(kakaoCompact != null);
        require(kakaoCompact.amount == 6_500L);
        require("스타벅스".equals(kakaoCompact.merchant));

        FinanceNotificationParser.Candidate kakaoFallback =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "kakao-fallback",
                        occurredAt + 7L,
                        Collections.singletonList("카카오페이 3,000원 결제가 완료되었습니다")
                );
        require(kakaoFallback != null);
        require(kakaoFallback.fallbackMerchant);
        require(FinanceNotificationParser.KAKAO_PAY_FALLBACK_MERCHANT.equals(
                kakaoFallback.merchant
        ));

        FinanceNotificationParser.Candidate kakaoDuplicateAmount =
                FinanceNotificationParser.parse(
                        FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                        "kakao-duplicate-amount",
                        occurredAt + 8L,
                        Arrays.asList(
                                "카카오페이 결제",
                                "편의점 2,400원 결제 완료",
                                "편의점 2,400원 결제 완료"
                        )
                );
        require(kakaoDuplicateAmount != null);
        require(kakaoDuplicateAmount.amount == 2_400L);

        require(FinanceNotificationParser.parse(
                "com.example.wallet",
                "unsupported-1",
                occurredAt,
                Collections.singletonList("스타벅스 4,500원 결제")
        ) == null);
        require(FinanceNotificationParser.parse(
                "com.kakao.talk",
                "kakao-talk-alimtalk",
                occurredAt,
                Collections.singletonList("[카카오페이] 스타벅스 4,500원 결제 완료")
        ) == null);
        require(FinanceNotificationParser.parse(
                "com.lgt.tmoney",
                "tmoney-payment",
                occurredAt,
                Collections.singletonList("버스 승차 이용금액 1,400원")
        ) == null);
        require(FinanceNotificationParser.parse(
                "kr.co.tmoney.tia",
                "tmoney-go-payment",
                occurredAt,
                Collections.singletonList("티머니 1,400원 결제")
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
        for (String rejected : new String[]{
                "카카오페이머니 10,000원 충전 완료",
                "친구에게 10,000원 송금 완료",
                "카카오페이 10,000원 결제 취소",
                "카카오페이 10,000원 환불",
                "10,000원 결제 포인트 적립 이벤트"
        }) {
            require(FinanceNotificationParser.parse(
                    FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                    "kakao-rejected-" + rejected.hashCode(),
                    occurredAt,
                    Collections.singletonList(rejected)
            ) == null);
        }

        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-missing-positive",
                occurredAt,
                Collections.singletonList("카카오페이머니 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-approval-not-payment",
                occurredAt,
                Collections.singletonList("본인 인증 승인 한도 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-purchase-not-payment",
                occurredAt,
                Collections.singletonList("쇼핑 구매 금액 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-future-payment",
                occurredAt,
                Collections.singletonList("정기 결제 예정 금액 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-marketing-payment",
                occurredAt,
                Collections.singletonList("카카오페이 결제 시 10,000원 할인")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-ambiguous-payment",
                occurredAt,
                Collections.singletonList("카카오페이 결제 금액 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-message-says-samsung",
                occurredAt,
                Collections.singletonList("삼성페이 결제완료 스타벅스 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.SAMSUNG_WALLET_PACKAGE,
                "samsung-message-says-kakao",
                occurredAt,
                Collections.singletonList("카카오페이 결제완료 스타벅스 10,000원")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-samsung-only-positive",
                occurredAt,
                Collections.singletonList("스타벅스 4,500원 카드사용")
        ) == null);
        require(FinanceNotificationParser.parse(
                FinanceNotificationParser.KAKAO_PAY_PACKAGE,
                "kakao-multiple-amounts",
                occurredAt,
                Collections.singletonList("스타벅스 4,500원 결제 잔액 20,000원")
        ) == null);

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
