package com.platform.aiassitant;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class FinanceNotificationParser {
    static final String SAMSUNG_WALLET_PACKAGE = "com.samsung.android.spay";
    static final String SAMSUNG_WALLET_SOURCE = "samsung-wallet";
    static final String SAMSUNG_WALLET_FALLBACK_MERCHANT = "삼성월렛";
    static final String KAKAO_PAY_PACKAGE = "com.kakaopay.app";
    static final String KAKAO_PAY_SOURCE = "kakao-pay";

    private static final long MAX_TRANSACTION_AMOUNT = 999_999_999L;
    private static final int MAX_TEXT_PARTS = 12;
    private static final int MAX_TEXT_PART_LENGTH = 512;
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?i)(?:[₩￦]|KRW\\s*)\\s*([0-9][0-9,]{0,14})"
                    + "|(?<![0-9,])([0-9][0-9,]{0,14})\\s*(?:원|KRW)"
    );
    private static final Pattern URL_PATTERN = Pattern.compile(
            "(?i)(?:https?://|www\\.)\\S+"
    );
    private static final Pattern BRACKETED_PATTERN = Pattern.compile(
            "[\\[【<][^\\]】>]{0,80}[\\]】>]"
    );
    private static final Pattern DATE_TIME_PATTERN = Pattern.compile(
            "(?<![0-9])(?:20[0-9]{2}[./-])?[0-9]{1,2}[./-][0-9]{1,2}"
                    + "(?:\\s+[0-9]{1,2}:[0-9]{2})?(?![0-9])"
                    + "|(?<![0-9])[0-9]{1,2}:[0-9]{2}(?![0-9])"
    );
    private static final Pattern PURE_NUMERIC_TOKEN_PATTERN = Pattern.compile(
            "[0-9０-９]+"
    );
    private static final Pattern SENSITIVE_NUMBER_TOKEN_PATTERN = Pattern.compile(
            ".*(?:[0-9０-９]{4,}|[*#xX•·-]{2,}[0-9０-９]{2,}"
                    + "|[0-9０-９]{2,}[*#xX•·-]{2,}).*"
    );
    private static final Pattern KAKAO_MERCHANT_LABEL_PATTERN = Pattern.compile(
            "(?i)(?:상호명|가맹점명|가맹점|결제처|사용처명|사용처|매장명|매장|merchant)"
                    + "(?:은|는|을|를)?\\s*(?:[:：=~|-])?\\s*(.{2,80}?)"
                    + "(?=\\s*(?:결제\\s*금액|결제금액|금액|결제\\s*(?:완료|승인)|"
                    + "결제수단|결제일시|승인일시|승인번호|거래번호|주문번호|"
                    + "[₩￦]|[0-9][0-9,]{0,14}\\s*(?:원|krw)|$))"
    );
    private static final Pattern KAKAO_MERCHANT_LABEL_ONLY_PATTERN = Pattern.compile(
            "(?i)^\\s*[\\[【(<]?\\s*(?:상호명|가맹점명|가맹점|결제처|"
                    + "사용처명|사용처|매장명|매장|merchant)(?:은|는|을|를)?"
                    + "\\s*[\\]】)>]?\\s*[:：=~|-]?\\s*$"
    );
    private static final Pattern MERCHANT_NOISE_PATTERN = Pattern.compile(
            "(?i)(삼성\\s*월렛|삼성\\s*페이|samsung\\s*(?:wallet|pay)|"
                    + "카카오\\s*페이(?:머니)?|kakao\\s*pay|"
                    + "가맹점명(?:은|는|을|를)?|가맹점(?:은|는|을|를)?|"
                    + "결제처(?:은|는|을|를)?|사용처명(?:은|는|을|를)?|사용처(?:은|는|을|를)?|"
                    + "상호명(?:은|는|을|를)?|상호(?:은|는|을|를)?|매장명(?:은|는|을|를)?|매장(?:은|는|을|를)?|merchant|"
                    + "결제금액|결제\\s*금액|승인번호|거래번호|"
                    + "카드\\s*사용|일시불|할부|거래|알림|"
                    + "결제|승인|사용|완료|되었습니다|처리되었습니다|했어요|금액|카드|계좌|잔액|누적|한도|고객|본인|원|krw)"
    );

    private static final String[] SAMSUNG_WALLET_POSITIVE_TERMS = {
            "결제", "승인", "카드사용", "카드 사용", "일시불", "할부",
            "payment", "purchase"
    };
    private static final String[] KAKAO_PAY_STRONG_POSITIVE_TERMS = {
            "결제완료", "결제 완료", "결제가 완료", "결제를 완료",
            "결제승인", "결제 승인", "결제했", "결제됐", "결제되었습니다",
            "payment approved", "payment complete", "payment completed"
    };
    private static final String[] COMMON_NEGATIVE_TERMS = {
            "승인취소", "승인 취소", "결제취소", "결제 취소", "취소",
            "환불", "거절", "실패", "미승인", "승인실패", "승인 실패",
            "광고", "이벤트", "쿠폰", "혜택",
            "입금", "출금", "송금", "이체", "atm", "현금인출", "현금 인출",
            "자동이체", "계좌이체", "대출", "예금", "적금"
    };
    private static final String[] KAKAO_PAY_NEGATIVE_TERMS = {
            "충전", "포인트 적립", "리워드", "송금받기",
            "결제예정", "결제 예정", "결제안내", "결제 안내",
            "결제방법", "결제 방법", "결제요청", "결제 요청",
            "결제한도", "결제 한도", "결제하면", "결제 시", "할인"
    };
    private static final Set<String> GENERIC_MERCHANTS = new LinkedHashSet<>();

    static {
        GENERIC_MERCHANTS.add("결제내역");
        GENERIC_MERCHANTS.add("결제 내역");
        GENERIC_MERCHANTS.add("카드내역");
        GENERIC_MERCHANTS.add("카드 내역");
        GENERIC_MERCHANTS.add("알림");
        GENERIC_MERCHANTS.add("승인완료");
        GENERIC_MERCHANTS.add("승인 완료");
        GENERIC_MERCHANTS.add("완료");
        GENERIC_MERCHANTS.add("되었습니다");
        GENERIC_MERCHANTS.add("처리되었습니다");
    }

    private FinanceNotificationParser() {}

    static boolean isSupportedPackage(String packageName) {
        return sourceForPackage(packageName) != null;
    }

    static String labelForSource(String source) {
        if (SAMSUNG_WALLET_SOURCE.equals(source)) {
            return "삼성페이";
        }
        if (KAKAO_PAY_SOURCE.equals(source)) {
            return "카카오페이";
        }
        return null;
    }

    static String sourceForPackage(String packageName) {
        if (SAMSUNG_WALLET_PACKAGE.equals(packageName)) {
            return SAMSUNG_WALLET_SOURCE;
        }
        if (KAKAO_PAY_PACKAGE.equals(packageName)) {
            return KAKAO_PAY_SOURCE;
        }
        return null;
    }

    static boolean isSupportedSource(String source) {
        return SAMSUNG_WALLET_SOURCE.equals(source)
                || KAKAO_PAY_SOURCE.equals(source);
    }

    static LinkedHashSet<String> supportedSources() {
        LinkedHashSet<String> sources = new LinkedHashSet<>();
        sources.add(SAMSUNG_WALLET_SOURCE);
        sources.add(KAKAO_PAY_SOURCE);
        return sources;
    }

    static Candidate parse(
            String packageName,
            String notificationKey,
            long occurredAt,
            List<String> textParts
    ) {
        String source = sourceForPackage(packageName);
        if (source == null || occurredAt <= 0L) {
            return null;
        }
        List<String> normalizedParts = normalizedParts(textParts);
        if (normalizedParts.isEmpty()) {
            return null;
        }
        String combined = join(normalizedParts, "\n");
        String searchable = combined.toLowerCase(Locale.ROOT);
        // The package is the authoritative source. If the visible message explicitly
        // names the other payment app, reject it instead of mislabelling the event.
        if (!messageMatchesSource(source, searchable)) {
            return null;
        }
        if (containsAny(searchable, COMMON_NEGATIVE_TERMS)
                || containsSourceNegativeTerm(source, searchable)
                || !hasSourcePositiveTerm(source, searchable)) {
            return null;
        }

        Long amount = uniqueTransactionAmount(combined);
        if (amount == null) {
            return null;
        }
        String merchant = merchantFrom(source, normalizedParts);
        boolean fallbackMerchant = merchant == null;
        // 카카오페이는 상호명을 확인할 수 있는 결제만 기록한다. 앱 이름을
        // 대체 상호로 저장하면 사용처가 아닌 정보가 가계부에 남기 때문이다.
        if (KAKAO_PAY_SOURCE.equals(source) && fallbackMerchant) {
            return null;
        }
        if (fallbackMerchant) {
            merchant = fallbackMerchantForSource(source);
        }
        String eventId = eventId(packageName, notificationKey, occurredAt, combined);
        return eventId == null
                ? null
                : new Candidate(
                        eventId,
                        source,
                        amount,
                        merchant,
                        occurredAt,
                        fallbackMerchant
                );
    }

    private static boolean hasSourcePositiveTerm(String source, String searchable) {
        if (SAMSUNG_WALLET_SOURCE.equals(source)) {
            return containsAny(searchable, SAMSUNG_WALLET_POSITIVE_TERMS);
        }
        if (KAKAO_PAY_SOURCE.equals(source)) {
            return containsAny(searchable, KAKAO_PAY_STRONG_POSITIVE_TERMS)
                    || searchable.contains("결제");
        }
        return false;
    }

    private static boolean messageMatchesSource(String source, String searchable) {
        boolean mentionsSamsung = searchable.contains("삼성페이")
                || searchable.contains("삼성 페이")
                || searchable.contains("samsung pay")
                || searchable.contains("삼성월렛")
                || searchable.contains("삼성 월렛")
                || searchable.contains("samsung wallet");
        boolean mentionsKakao = searchable.contains("카카오페이")
                || searchable.contains("카카오 페이")
                || searchable.contains("kakao pay");
        if (SAMSUNG_WALLET_SOURCE.equals(source)) {
            return !mentionsKakao || mentionsSamsung;
        }
        if (KAKAO_PAY_SOURCE.equals(source)) {
            return !mentionsSamsung || mentionsKakao;
        }
        return false;
    }

    private static boolean containsSourceNegativeTerm(String source, String searchable) {
        if (KAKAO_PAY_SOURCE.equals(source)) {
            return containsAny(searchable, KAKAO_PAY_NEGATIVE_TERMS);
        }
        return false;
    }

    private static String fallbackMerchantForSource(String source) {
        return SAMSUNG_WALLET_FALLBACK_MERCHANT;
    }

    private static List<String> normalizedParts(List<String> values) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        if (values == null) {
            return new ArrayList<>();
        }
        for (String value : values) {
            if (unique.size() >= MAX_TEXT_PARTS) {
                break;
            }
            String normalized = normalizedText(value);
            if (!normalized.isEmpty()) {
                unique.add(normalized);
            }
        }
        return new ArrayList<>(unique);
    }

    private static String normalizedText(String value) {
        String normalized = String.valueOf(value == null ? "" : value)
                .replace('\u0000', ' ')
                .replace('\u00a0', ' ')
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.length() > MAX_TEXT_PART_LENGTH) {
            normalized = normalized.substring(0, MAX_TEXT_PART_LENGTH);
        }
        return normalized;
    }

    private static boolean containsAny(String value, String[] terms) {
        for (String term : terms) {
            if (value.contains(term)) {
                return true;
            }
        }
        return false;
    }

    private static Set<Long> transactionAmounts(String value) {
        LinkedHashSet<Long> amounts = new LinkedHashSet<>();
        Matcher matcher = AMOUNT_PATTERN.matcher(value);
        while (matcher.find()) {
            String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
            Long parsed = parseAmount(raw);
            if (parsed != null) {
                amounts.add(parsed);
            }
        }
        return amounts;
    }

    private static Long uniqueTransactionAmount(String value) {
        Set<Long> amounts = transactionAmounts(value);
        return amounts.size() == 1 ? amounts.iterator().next() : null;
    }

    private static Long parseAmount(String raw) {
        if (raw == null) {
            return null;
        }
        if (raw.contains(",") && !raw.matches("[0-9]{1,3}(?:,[0-9]{3})+")) {
            return null;
        }
        String digits = raw.replace(",", "");
        if (!digits.matches("[0-9]{1,12}")) {
            return null;
        }
        try {
            long amount = Long.parseLong(digits);
            return amount > 0L && amount <= MAX_TRANSACTION_AMOUNT ? amount : null;
        } catch (NumberFormatException invalidAmount) {
            return null;
        }
    }

    private static String merchantFrom(String source, List<String> parts) {
        if (KAKAO_PAY_SOURCE.equals(source)) {
            String labeled = kakaoMerchantFromLabel(parts);
            if (labeled != null) {
                return labeled;
            }
        }
        return merchantFrom(parts);
    }

    private static String kakaoMerchantFromLabel(List<String> parts) {
        for (int index = 0; index < parts.size(); index += 1) {
            String part = parts.get(index);
            Matcher matcher = KAKAO_MERCHANT_LABEL_PATTERN.matcher(part);
            while (matcher.find()) {
                String candidate = cleanedMerchantCandidate(matcher.group(1));
                if (isSafeMerchant(candidate)) {
                    return candidate;
                }
            }
            if (KAKAO_MERCHANT_LABEL_ONLY_PATTERN.matcher(part).matches()) {
                for (int offset = 1; offset <= 2 && index + offset < parts.size(); offset += 1) {
                    String adjacent = parts.get(index + offset);
                    String candidate = cleanedMerchantCandidate(adjacent);
                    if (isSafeMerchant(candidate)) {
                        return candidate;
                    }
                }
            }
        }
        return null;
    }

    private static String merchantFrom(List<String> parts) {
        String best = null;
        int bestScore = Integer.MIN_VALUE;
        for (String part : parts) {
            boolean includesAmount = AMOUNT_PATTERN.matcher(part).find();
            String candidate = cleanedMerchantCandidate(part);
            if (!isSafeMerchant(candidate)) {
                continue;
            }
            int score = (includesAmount ? 100 : 0) - candidate.length();
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return best;
    }

    private static String cleanedMerchantCandidate(String value) {
        String candidate = AMOUNT_PATTERN.matcher(value).replaceAll(" ");
        candidate = URL_PATTERN.matcher(candidate).replaceAll(" ");
        candidate = BRACKETED_PATTERN.matcher(candidate).replaceAll(" ");
        candidate = DATE_TIME_PATTERN.matcher(candidate).replaceAll(" ");
        candidate = MERCHANT_NOISE_PATTERN.matcher(candidate).replaceAll(" ");
        candidate = candidate
                .replaceAll("[\\p{Cntrl}\\p{So}]+", " ")
                .replaceAll("[|/\\\\·•:;,_=+*#~^!?(){}]+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return withoutNumericTokens(candidate);
    }

    private static String withoutNumericTokens(String value) {
        StringBuilder kept = new StringBuilder();
        for (String token : value.split("\\s+")) {
            if (token.isEmpty()
                    || PURE_NUMERIC_TOKEN_PATTERN.matcher(token).matches()
                    || hasSensitiveNumber(token)) {
                continue;
            }
            if (kept.length() > 0) {
                kept.append(' ');
            }
            kept.append(token);
        }
        String result = kept.toString().trim();
        return result.length() > 80 ? result.substring(0, 80).trim() : result;
    }

    private static boolean isSafeMerchant(String value) {
        if (value == null || value.length() < 2 || value.length() > 80) {
            return false;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        if (GENERIC_MERCHANTS.contains(normalized)
                || hasSensitiveNumber(value)) {
            return false;
        }
        for (String forbidden : new String[]{"카드", "계좌", "잔액", "승인번호", "거래번호"}) {
            if (normalized.contains(forbidden)) {
                return false;
            }
        }
        return true;
    }

    private static boolean hasSensitiveNumber(String value) {
        if (SENSITIVE_NUMBER_TOKEN_PATTERN.matcher(value).matches()) {
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

    private static String eventId(
            String packageName,
            String notificationKey,
            long occurredAt,
            String fallbackText
    ) {
        String stableKey = normalizedText(notificationKey);
        String material = "finance-notification-v2\u0000" + packageName + "\u0000"
                + stableKey + "\u0000" + occurredAt
                + (stableKey.isEmpty() ? "\u0000" + fallbackText : "");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(material.getBytes(StandardCharsets.UTF_8));
            StringBuilder encoded = new StringBuilder("fn-");
            for (byte item : hashed) {
                encoded.append(String.format(Locale.US, "%02x", item & 0xff));
            }
            return encoded.toString();
        } catch (NoSuchAlgorithmException unavailable) {
            return null;
        }
    }

    private static String join(List<String> values, String separator) {
        StringBuilder joined = new StringBuilder();
        for (String value : values) {
            if (joined.length() > 0) {
                joined.append(separator);
            }
            joined.append(value);
        }
        return joined.toString();
    }

    static final class Candidate {
        final String eventId;
        final String source;
        final long amount;
        final String merchant;
        final long occurredAt;
        final boolean fallbackMerchant;

        Candidate(
                String eventId,
                String source,
                long amount,
                String merchant,
                long occurredAt,
                boolean fallbackMerchant
        ) {
            this.eventId = eventId;
            this.source = source;
            this.amount = amount;
            this.merchant = merchant;
            this.occurredAt = occurredAt;
            this.fallbackMerchant = fallbackMerchant;
        }
    }
}
