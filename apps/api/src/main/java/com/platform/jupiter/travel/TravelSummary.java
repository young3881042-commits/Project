package com.platform.jupiter.travel;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record TravelSummary(
        LocalDateTime liveTimestamp,
        LocalDate latestStatDate,
        long totalVisitors,
        long totalSearches,
        long totalBookings,
        java.math.BigDecimal foreignVisitorShare,
        long activeBatchRuns,
        long districtCount,
        long placeCount) {
}
