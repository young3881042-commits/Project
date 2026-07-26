package com.platform.jupiter.travel;

import java.math.BigDecimal;

public record PlaceSnapshot(
        String placeId,
        String regionCode,
        String regionName,
        String districtCode,
        String districtName,
        String placeName,
        String category,
        String address,
        String headline,
        String tagsJson,
        long liveSearches,
        long liveBookings,
        int avgStayMinutes,
        BigDecimal occupancyRate) {
}
