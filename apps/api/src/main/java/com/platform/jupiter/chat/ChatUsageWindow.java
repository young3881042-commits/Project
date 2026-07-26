package com.platform.jupiter.chat;

import java.time.Instant;

public record ChatUsageWindow(
        String id,
        String label,
        Instant since,
        long calls,
        long inputTokens,
        long outputTokens,
        long totalTokens) {
}
