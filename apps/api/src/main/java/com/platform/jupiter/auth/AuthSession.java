package com.platform.jupiter.auth;

public record AuthSession(
        String username,
        String role,
        boolean admin,
        String token) {
}
