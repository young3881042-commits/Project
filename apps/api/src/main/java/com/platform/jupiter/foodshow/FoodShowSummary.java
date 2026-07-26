package com.platform.jupiter.foodshow;

import java.time.LocalDateTime;

public record FoodShowSummary(
        long showCount,
        long participantCount,
        long venueCount,
        long categoryCount,
        long resolvedLocationCount,
        long pendingLocationCount,
        LocalDateTime updatedAt) {
}
