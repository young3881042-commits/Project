package com.platform.jupiter.rag;

import java.time.Instant;
import java.util.List;

public record WeatherRagStatusResponse(
        boolean enabled,
        boolean vectorStoreConfigured,
        String collectionName,
        Instant updatedAt,
        int locationCount,
        List<String> locations,
        String source) {
}
