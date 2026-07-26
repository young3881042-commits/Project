package com.platform.jupiter.rag;

import java.time.Instant;
import java.util.List;

public record DomainRagStatusResponse(
        List<String> domains,
        int documentCount,
        Instant lastRefreshedAt,
        String source) {
}
