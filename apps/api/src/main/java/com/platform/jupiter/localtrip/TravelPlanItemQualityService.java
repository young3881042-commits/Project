package com.platform.jupiter.localtrip;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class TravelPlanItemQualityService {
    private final LocalTripRealPlaceService realPlaceService;

    public TravelPlanItemQualityService(LocalTripRealPlaceService realPlaceService) {
        this.realPlaceService = realPlaceService;
    }

    public List<TravelPlanItem> normalize(
            TravelPlan plan,
            List<TravelPlanItem> items,
            List<Destination> candidates,
            boolean replaceFoodPlaces) {
        List<TravelPlanItem> cleaned = removeExactDuplicates(items);
        if (replaceFoodPlaces) {
            applyVerifiedFoodPlaces(plan, cleaned);
        }
        return resequence(removeOrReplaceDuplicateVisitItems(plan, cleaned, candidates));
    }

    private List<TravelPlanItem> removeExactDuplicates(List<TravelPlanItem> items) {
        Set<String> seen = new LinkedHashSet<>();
        List<TravelPlanItem> cleaned = new ArrayList<>();
        for (TravelPlanItem item : items) {
            String key = item.getDayNumber() + "|"
                    + LocalTripText.normalize(item.getTimeSlot()).toLowerCase() + "|"
                    + LocalTripDestinationQuality.normalizePlaceName(item.getDestinationName());
            if (seen.add(key)) {
                cleaned.add(item);
            }
        }
        return cleaned;
    }

    private void applyVerifiedFoodPlaces(TravelPlan plan, List<TravelPlanItem> items) {
        Map<String, Integer> slotUseCounts = new HashMap<>();
        Map<String, Set<String>> usedPlaceKeysByStyle = new HashMap<>();
        Map<String, List<RealLocalPlaceResponse>> candidateCache = new HashMap<>();
        for (TravelPlanItem item : items) {
            if (!LocalTripDestinationQuality.isFoodOrCafeItem(item)) {
                continue;
            }
            String style = LocalTripDestinationQuality.normalizeFoodStyle(item.getPrimaryStyle());
            String counterKey = item.getDayNumber() + ":" + style;
            int ordinal = slotUseCounts.merge(counterKey, 1, Integer::sum) - 1;
            Set<String> usedPlaceKeys = usedPlaceKeysByStyle.computeIfAbsent(style, ignored -> new HashSet<>());
            RealLocalPlaceResponse place = selectFoodPlace(plan, style, item, ordinal, usedPlaceKeys, candidateCache);
            if (place == null) {
                continue;
            }
            usedPlaceKeys.add(foodPlaceKey(place));
            item.setDestinationId(null);
            item.setDestinationName(place.name());
            item.setRegion(place.region());
            item.setPrimaryStyle(place.category());
            item.setNote(limitText(placeNote(place), 240));
            item.setDurationMinutes(normalizeDuration(item.getDurationMinutes()));
        }
    }

    private RealLocalPlaceResponse selectFoodPlace(
            TravelPlan plan,
            String style,
            TravelPlanItem item,
            int ordinal,
            Set<String> usedPlaceKeys,
            Map<String, List<RealLocalPlaceResponse>> candidateCache) {
        List<RealLocalPlaceResponse> candidates = candidateCache.computeIfAbsent(style, value ->
                realPlaceService.suggestFoodPlaces(plan.getRegion(), value, item.getDestinationName(), 15));
        if (candidates.isEmpty()) {
            return null;
        }
        int day = item.getDayNumber() == null ? 1 : item.getDayNumber();
        int start = Math.floorMod(Math.max(0, day - 1) + Math.max(0, ordinal), candidates.size());
        for (int offset = 0; offset < candidates.size(); offset++) {
            RealLocalPlaceResponse candidate = candidates.get((start + offset) % candidates.size());
            if (!usedPlaceKeys.contains(foodPlaceKey(candidate))) {
                return candidate;
            }
        }
        return candidates.get(start);
    }

    private List<TravelPlanItem> removeOrReplaceDuplicateVisitItems(TravelPlan plan, List<TravelPlanItem> items, List<Destination> candidates) {
        Set<String> usedVisitNames = new HashSet<>();
        List<TravelPlanItem> cleaned = new ArrayList<>();
        List<Destination> visitCandidates = candidates.stream()
                .filter(destination -> !LocalTripDestinationQuality.isFoodOrCafeDestination(destination))
                .toList();
        for (TravelPlanItem item : items) {
            if (!isTravelVisitItem(item)) {
                cleaned.add(item);
                continue;
            }
            String key = LocalTripDestinationQuality.normalizePlaceName(item.getDestinationName());
            if (key.isBlank() || usedVisitNames.add(key)) {
                cleaned.add(item);
                continue;
            }
            Destination replacement = selectUnusedVisitDestination(item, visitCandidates, usedVisitNames);
            if (replacement == null) {
                continue;
            }
            applyDestinationReplacement(plan, item, replacement);
            usedVisitNames.add(LocalTripDestinationQuality.normalizePlaceName(replacement.getName()));
            cleaned.add(item);
        }
        return cleaned;
    }

    private boolean isTravelVisitItem(TravelPlanItem item) {
        if (item == null || LocalTripDestinationQuality.isFoodOrCafeItem(item)) {
            return false;
        }
        String text = String.join(" ",
                defaultText(item.getDestinationName()),
                defaultText(item.getPrimaryStyle()),
                defaultText(item.getNote())).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        return !text.matches(".*(이동|출발|도착|숙소|호텔|체크인|체크아웃|휴식|마무리|transfer|hotel|rest).*");
    }

    private Destination selectUnusedVisitDestination(
            TravelPlanItem item,
            List<Destination> candidates,
            Set<String> usedVisitNames) {
        List<Destination> matching = candidates.stream()
                .filter(destination -> !usedVisitNames.contains(LocalTripDestinationQuality.normalizePlaceName(destination.getName())))
                .filter(destination -> LocalTripDestinationQuality.matchesVisitSlot(destination, item.getPrimaryStyle()))
                .toList();
        List<Destination> pool = matching.isEmpty()
                ? candidates.stream()
                        .filter(destination -> !usedVisitNames.contains(LocalTripDestinationQuality.normalizePlaceName(destination.getName())))
                        .toList()
                : matching;
        if (pool.isEmpty()) {
            return null;
        }
        int day = item.getDayNumber() == null ? 1 : item.getDayNumber();
        int sequence = item.getSequenceNumber() == null ? 0 : item.getSequenceNumber();
        return pool.get(Math.floorMod((day * 31) + sequence, pool.size()));
    }

    private void applyDestinationReplacement(TravelPlan plan, TravelPlanItem item, Destination destination) {
        item.setDestinationId(destination.getId());
        item.setDestinationName(destination.getName());
        item.setRegion(defaultText(destination.getRegion(), plan.getRegion()));
        item.setPrimaryStyle(limitText(defaultText(destination.getPrimaryStyle(), defaultText(destination.getCategory(), "관광지")), 36));
        item.setDurationMinutes(destination.getRecommendedMinutes() == null
                ? normalizeDuration(item.getDurationMinutes() == null ? 0 : item.getDurationMinutes())
                : normalizeDuration(destination.getRecommendedMinutes()));
        item.setNote(limitText(replacementVisitNote(destination), 240));
    }

    private List<TravelPlanItem> resequence(List<TravelPlanItem> items) {
        List<TravelPlanItem> sorted = items.stream()
                .sorted(Comparator
                        .comparing((TravelPlanItem item) -> item.getDayNumber() == null ? 1 : item.getDayNumber())
                        .thenComparing(item -> item.getSequenceNumber() == null ? 0 : item.getSequenceNumber()))
                .toList();
        int sequence = 1;
        for (TravelPlanItem item : sorted) {
            item.setSequenceNumber(sequence++);
        }
        return sorted;
    }

    private String replacementVisitNote(Destination destination) {
        List<String> parts = new ArrayList<>();
        if (!LocalTripText.normalize(destination.getHeadline()).isBlank()) {
            parts.add(destination.getHeadline());
        } else if (!LocalTripText.normalize(destination.getDescription()).isBlank()) {
            parts.add(limitText(destination.getDescription(), 120));
        }
        if (!LocalTripText.normalize(destination.getAddress()).isBlank()) {
            parts.add("주소: " + destination.getAddress());
        }
        if (!LocalTripText.normalize(destination.getStyleTags()).isBlank()) {
            parts.add("테마: " + destination.getStyleTags());
        }
        return parts.isEmpty() ? "일자별 중복을 피하기 위해 같은 지역의 다른 방문지로 배치했습니다." : String.join(" · ", parts);
    }

    private String placeNote(RealLocalPlaceResponse place) {
        List<String> parts = new ArrayList<>();
        parts.add(defaultText(place.roadAddress(), defaultText(place.address(), "주소 미정")));
        if (!LocalTripText.normalize(place.recommendedMenu()).isBlank()) {
            parts.add("추천 메뉴: " + place.recommendedMenu());
        }
        if (!LocalTripText.normalize(place.phone()).isBlank()) {
            parts.add("전화: " + place.phone());
        }
        if (!LocalTripText.normalize(place.verificationNote()).isBlank()) {
            parts.add(place.verificationNote());
        }
        return String.join(" · ", parts);
    }

    private String foodPlaceKey(RealLocalPlaceResponse place) {
        return LocalTripText.normalize(place.category()).toLowerCase()
                + ":"
                + LocalTripDestinationQuality.normalizePlaceName(place.name());
    }

    private int normalizeDuration(Integer durationMinutes) {
        if (durationMinutes == null || durationMinutes <= 0) {
            return 120;
        }
        return Math.min(240, Math.max(45, durationMinutes));
    }

    private String limitText(String value, int maxLength) {
        String normalized = LocalTripText.normalize(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }

    private String defaultText(String value) {
        return value == null ? "" : value;
    }

    private String defaultText(String value, String fallback) {
        String normalized = LocalTripText.normalize(value);
        return normalized.isBlank() ? fallback : normalized;
    }
}
