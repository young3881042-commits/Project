package com.platform.jupiter.localtrip;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class LocalTripDestinationQuality {
    private LocalTripDestinationQuality() {
    }

    static List<Destination> forDisplay(List<Destination> destinations) {
        List<Destination> deduplicated = deduplicateBest(destinations).stream()
                .sorted(qualityComparator())
                .toList();
        List<Destination> concrete = concreteOnly(deduplicated);
        return concrete.isEmpty() ? deduplicated : concrete;
    }

    static List<Destination> forPlanning(List<Destination> destinations) {
        List<Destination> deduplicated = forDisplay(destinations);
        List<Destination> concrete = concreteOnly(deduplicated);
        return concrete.isEmpty() ? deduplicated : concrete;
    }

    static boolean isFoodOrCafeDestination(Destination destination) {
        String text = (defaultText(destination.getPrimaryStyle()) + " "
                + defaultText(destination.getCategory()) + " "
                + defaultText(destination.getStyleTags()) + " "
                + defaultText(destination.getName())).toLowerCase(Locale.ROOT);
        return text.matches(".*(식당|맛집|시장|카페|커피|디저트|브런치|간식|베이커리|먹자|food|cafe|coffee|market|snack).*");
    }

    static boolean isFoodOrCafeItem(TravelPlanItem item) {
        String style = LocalTripText.normalize(item.getPrimaryStyle()).toLowerCase(Locale.ROOT);
        if (style.matches(".*(식당|식사|맛집|아침|점심|저녁|한식|분식|레스토랑|restaurant|meal|카페|커피|디저트|브런치|간식|베이커리|cafe|coffee|bakery|snack).*")) {
            return true;
        }
        String note = LocalTripText.normalize(item.getNote()).toLowerCase(Locale.ROOT);
        return note.matches(".*(추천 메뉴|아침|점심|저녁|식사|커피|디저트|브런치|간식|menu|snack).*");
    }

    static String normalizeFoodStyle(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.matches(".*(카페|커피|디저트|브런치|간식|베이커리).*") ? "카페" : "식당";
    }

    static boolean matchesVisitSlot(Destination destination, String slotStyle) {
        String style = LocalTripText.normalize(slotStyle);
        String text = (defaultText(destination.getPrimaryStyle()) + " "
                + defaultText(destination.getCategory()) + " "
                + defaultText(destination.getStyleTags())).toLowerCase(Locale.ROOT);
        if (style.contains("야경")) {
            return text.matches(".*(야경|전망|타워|해변|공원|사진).*");
        }
        if (style.contains("산책")) {
            return text.matches(".*(산책|자연|공원|거리|마을|해변|호수|숲).*");
        }
        return text.matches(".*(관광|역사|사진|자연|공원|궁궐|사찰|신사|전망|마을|거리|유적|박물관).*");
    }

    static String normalizePlaceName(String value) {
        return value == null ? "" : value.replaceAll("[\\s\\p{Punct}·]+", "").toLowerCase(Locale.ROOT);
    }

    private static List<Destination> deduplicateBest(List<Destination> destinations) {
        Map<String, Destination> bestByKey = new LinkedHashMap<>();
        for (Destination destination : destinations) {
            String key = dedupeKey(destination);
            Destination current = bestByKey.get(key);
            if (current == null || qualityComparator().compare(destination, current) < 0) {
                bestByKey.put(key, destination);
            }
        }
        return List.copyOf(bestByKey.values());
    }

    private static List<Destination> concreteOnly(List<Destination> destinations) {
        return destinations.stream()
                .filter(destination -> !isPlaceholderDestination(destination))
                .toList();
    }

    private static Comparator<Destination> qualityComparator() {
        return Comparator
                .comparing(LocalTripDestinationQuality::isPlaceholderDestination)
                .thenComparingInt(LocalTripDestinationQuality::sourceRank)
                .thenComparing(Comparator.comparing(LocalTripDestinationQuality::popularity).reversed())
                .thenComparing(Destination::getName, Comparator.nullsLast(String::compareTo));
    }

    private static String dedupeKey(Destination destination) {
        return LocalTripText.normalize(destination.getRegion()).toLowerCase(Locale.ROOT)
                + ":"
                + normalizePlaceName(destination.getName());
    }

    private static boolean isPlaceholderDestination(Destination destination) {
        String source = defaultText(destination.getSource()).toLowerCase(Locale.ROOT);
        String name = LocalTripText.normalize(destination.getName());
        String headline = LocalTripText.normalize(destination.getHeadline());
        return source.equals("kr-regional-bulk")
                || name.matches(".*(스팟|추천장소|추천 장소|여행지 후보).*")
                || headline.matches(".*(데이터셋|샘플|후보).*");
    }

    private static int sourceRank(Destination destination) {
        return switch (defaultText(destination.getSource())) {
            case "kr-regional", "tour-api", "db" -> 0;
            case "mock", "admin1-batch" -> 1;
            case "kr-regional-bulk" -> 4;
            default -> 2;
        };
    }

    private static int popularity(Destination destination) {
        return destination.getPopularityScore() == null ? 0 : destination.getPopularityScore();
    }

    private static String defaultText(String value) {
        return value == null ? "" : value;
    }
}
