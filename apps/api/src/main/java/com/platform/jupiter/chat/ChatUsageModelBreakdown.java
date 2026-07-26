package com.platform.jupiter.chat;

public record ChatUsageModelBreakdown(
        String providerId,
        String model,
        long calls,
        long inputTokens,
        long outputTokens,
        long totalTokens) {
}
