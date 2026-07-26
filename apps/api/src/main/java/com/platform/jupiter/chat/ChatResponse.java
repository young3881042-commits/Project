package com.platform.jupiter.chat;

import java.time.Instant;

public record ChatResponse(
        String assistantMessage,
        String transcriptPath,
        String title,
        Instant savedAt,
        ChatUsage usage) {
}
