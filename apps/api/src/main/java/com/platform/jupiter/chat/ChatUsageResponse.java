package com.platform.jupiter.chat;

import java.time.Instant;
import java.util.List;

public record ChatUsageResponse(
        Instant generatedAt,
        List<ChatUsageWindow> windows,
        List<ChatUsageModelBreakdown> models) {
}
