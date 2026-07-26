package com.platform.jupiter.foodshow;

public record FoodShowView(
        String slug,
        String title,
        String subtitle,
        String networkName,
        String premiereLabel,
        int officialParticipantCount,
        String description,
        String heroNote,
        int entryCount,
        int categoryCount) {
}
