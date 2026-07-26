package com.platform.jupiter.chat;

public record ChatUsage(
        long inputTokens,
        long outputTokens,
        long totalTokens) {
}
