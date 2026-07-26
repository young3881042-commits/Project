package com.platform.jupiter.localtrip;

import java.util.List;

public record TravelPlanDayResponse(
        Integer dayNumber,
        String title,
        String summary,
        List<TravelPlanItemResponse> items) {
}
