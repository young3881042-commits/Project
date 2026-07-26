package com.platform.jupiter.travel;

import java.time.LocalDate;

public record TravelTrendPoint(
        LocalDate statDate,
        long visitorCount,
        long searchCount,
        long bookingCount) {
}
