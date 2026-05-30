package com.platform.jupiter.localtrip;

import java.time.Instant;
import java.util.List;

public record DestinationResponse(
        Long id,
        String name,
        String region,
        String district,
        String category,
        String primaryStyle,
        List<String> styleTags,
        String address,
        String headline,
        String imageUrl,
        String description,
        Integer recommendedMinutes,
        Integer popularityScore,
        String source,
        String sourceRef,
        Instant createdAt,
        Instant updatedAt) {
    public static DestinationResponse from(Destination destination) {
        return new DestinationResponse(
                destination.getId(),
                destination.getName(),
                destination.getRegion(),
                destination.getDistrict(),
                destination.getCategory(),
                destination.getPrimaryStyle(),
                LocalTripText.splitCsv(destination.getStyleTags()),
                destination.getAddress(),
                destination.getHeadline(),
                destination.getImageUrl(),
                destination.getDescription(),
                destination.getRecommendedMinutes(),
                destination.getPopularityScore(),
                destination.getSource(),
                destination.getSourceRef(),
                destination.getCreatedAt(),
                destination.getUpdatedAt());
    }
}
