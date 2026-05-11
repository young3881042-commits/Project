package com.platform.jupiter.localtrip;

import java.time.Instant;

public record TravelPlanItemResponse(
        Long id,
        Long destinationId,
        Integer dayNumber,
        Integer sequenceNumber,
        String timeSlot,
        String destinationName,
        String region,
        String primaryStyle,
        String note,
        String imageUrl,
        Integer durationMinutes,
        Instant createdAt,
        Instant updatedAt) {
    public static TravelPlanItemResponse from(TravelPlanItem item) {
        return from(item, null);
    }

    public static TravelPlanItemResponse from(TravelPlanItem item, Destination destination) {
        return new TravelPlanItemResponse(
                item.getId(),
                item.getDestinationId(),
                item.getDayNumber(),
                item.getSequenceNumber(),
                item.getTimeSlot(),
                item.getDestinationName(),
                item.getRegion(),
                item.getPrimaryStyle(),
                item.getNote(),
                destination == null ? null : LocalTripImageCatalog.resolveOrExisting(destination),
                item.getDurationMinutes(),
                item.getCreatedAt(),
                item.getUpdatedAt());
    }
}
