package com.platform.jupiter.localtrip;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class LocalTripRealPlaceService {
    private static final int DEFAULT_LIMIT = 8;

    private final DestinationRepository destinationRepository;
    private final LocalTripMapSearchService mapSearchService;
    private final LocalTripSchemaService schemaService;

    public LocalTripRealPlaceService(
            DestinationRepository destinationRepository,
            LocalTripMapSearchService mapSearchService,
            LocalTripSchemaService schemaService) {
        this.destinationRepository = destinationRepository;
        this.mapSearchService = mapSearchService;
        this.schemaService = schemaService;
    }

    public List<RealLocalPlaceResponse> suggestFoodPlaces(String region, String style, String anchor, Integer limit) {
        schemaService.ensureSchema();
        int normalizedLimit = normalizeLimit(limit);
        String category = normalizeCategory(style);
        Map<String, RealLocalPlaceResponse> results = new LinkedHashMap<>();

        for (Destination destination : destinationRepository.findAllByOrderByRegionAscPopularityScoreDescNameAsc()) {
            if (results.size() >= normalizedLimit) {
                break;
            }
            if (matchesDestination(destination, region, category)) {
                add(results, RealLocalPlaceResponse.fromDestination(destination));
            }
        }

        if (results.size() < normalizedLimit) {
            for (MapPlaceResponse place : mapSearchService.searchKakaoFoodPlaces(region, category, anchor, normalizedLimit)) {
                if (results.size() >= normalizedLimit) {
                    break;
                }
                add(results, RealLocalPlaceResponse.fromMapPlace(place, bestRegion(region), category));
            }
        }

        for (int ordinal = 0; results.size() < normalizedLimit && ordinal < normalizedLimit; ordinal++) {
            VerifiedLocalPlaceCatalog.VerifiedPlace place = VerifiedLocalPlaceCatalog.pick(region, category, 1, ordinal);
            if (place == null) {
                break;
            }
            add(results, RealLocalPlaceResponse.fromCatalog(place));
        }

        return new ArrayList<>(results.values());
    }

    public RealLocalPlaceResponse pickFoodPlace(String region, String style, int dayNumber, int ordinal, String anchor) {
        String category = normalizeCategory(style);
        List<RealLocalPlaceResponse> candidates = suggestFoodPlaces(region, category, anchor, Math.max(DEFAULT_LIMIT, ordinal + 1));
        if (!candidates.isEmpty()) {
            return candidates.get(Math.floorMod(Math.max(0, dayNumber - 1) + Math.max(0, ordinal), candidates.size()));
        }
        VerifiedLocalPlaceCatalog.VerifiedPlace place = VerifiedLocalPlaceCatalog.pick(region, category, dayNumber, ordinal);
        return place == null ? null : RealLocalPlaceResponse.fromCatalog(place);
    }

    private boolean matchesDestination(Destination destination, String region, String category) {
        if (!isFoodOrCafe(destination)) {
            return false;
        }
        if (!normalizeCategory(destination.getPrimaryStyle()).equals(category)) {
            return false;
        }
        String requestedRegion = LocalTripText.normalize(region);
        if (requestedRegion.isBlank() || "전국".equals(requestedRegion)) {
            return true;
        }
        String destinationRegion = LocalTripText.normalize(destination.getRegion());
        String address = LocalTripText.normalize(destination.getAddress());
        return requestedRegion.contains(destinationRegion)
                || destinationRegion.contains(requestedRegion)
                || requestedRegion.contains(address)
                || address.contains(requestedRegion)
                || List.of(requestedRegion.split("·")).stream().anyMatch(part ->
                        !part.isBlank() && (destinationRegion.contains(part) || address.contains(part)));
    }

    private boolean isFoodOrCafe(Destination destination) {
        String text = (defaultText(destination.getPrimaryStyle()) + " "
                + defaultText(destination.getCategory()) + " "
                + defaultText(destination.getStyleTags()) + " "
                + defaultText(destination.getName())).toLowerCase();
        return text.matches(".*(식당|맛집|시장|카페|커피|디저트|브런치|먹자|food|cafe|coffee|restaurant|market).*");
    }

    private void add(Map<String, RealLocalPlaceResponse> results, RealLocalPlaceResponse place) {
        String key = normalizeKey(place.region(), place.category(), place.name(), place.address());
        results.putIfAbsent(key, place);
    }

    private String normalizeCategory(String value) {
        String normalized = LocalTripText.normalize(value);
        return normalized.contains("카페") || normalized.contains("디저트") || normalized.contains("브런치") ? "카페" : "식당";
    }

    private String bestRegion(String region) {
        String normalized = LocalTripText.normalize(region);
        if (normalized.isBlank()) {
            return "국내";
        }
        return normalized.contains("·") ? normalized.substring(0, normalized.indexOf('·')) : normalized;
    }

    private int normalizeLimit(Integer limit) {
        return limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(15, limit));
    }

    private String normalizeKey(String region, String category, String name, String address) {
        String normalizedAddress = LocalTripText.normalize(address)
                .replace("일대", "")
                .replaceAll("\\s+", "");
        return (LocalTripText.normalize(region) + ":"
                + LocalTripText.normalize(category) + ":"
                + LocalTripText.normalize(name) + ":"
                + normalizedAddress)
                .replaceAll("\\s+", "")
                .toLowerCase();
    }

    private String defaultText(String value) {
        return value == null ? "" : value;
    }
}
