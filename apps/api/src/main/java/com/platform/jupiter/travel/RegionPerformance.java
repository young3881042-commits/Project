package com.platform.jupiter.travel;

public record RegionPerformance(
        String regionCode,
        String regionName,
        String regionGroup,
        long liveSearches,
        long liveBookings,
        long dailyVisitors,
        int districtCount,
        java.math.BigDecimal occupancyRate,
        java.math.BigDecimal yoyChangeRate) {
}
