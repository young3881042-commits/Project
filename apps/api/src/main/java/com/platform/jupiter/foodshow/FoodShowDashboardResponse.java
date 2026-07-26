package com.platform.jupiter.foodshow;

import java.util.List;

public record FoodShowDashboardResponse(
        FoodShowSummary summary,
        List<FoodShowView> shows,
        List<FoodCategoryView> categories,
        List<FoodShowEntryView> entries) {
}
