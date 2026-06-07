package com.platform.jupiter.travel;

import java.math.BigDecimal;

public record DistrictPerformance(
        String regionCode,
        String regionName,
        String regionGroup,
        String districtCode,
        String districtName,
        String districtTier,
        long liveSearches,
        long liveBookings,
        int placeCount,
        int avgStayMinutes,
        BigDecimal occupancyRate,
        BigDecimal yoyChangeRate,
        BigDecimal foreignVisitorShare) {
}
