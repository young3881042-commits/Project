package com.platform.jupiter.foodshow;

public record FoodCategoryView(
        String slug,
        String name,
        String description,
        int showCount,
        int entryCount) {
}
