package com.platform.jupiter.web;

public record AuthProviderDto(
        String id,
        String label,
        boolean enabled,
        String actionUrl,
        String description) {
}
