package com.platform.jupiter.chat;

public record ChatProviderStatus(
        String id,
        String label,
        boolean enabled,
        boolean connected,
        String message,
        String baseUrl,
        String defaultModel) {
}
