package com.platform.jupiter.auth;

public record AuthResponse(
        String username,
        String role,
        String token,
        String launcherUrl) {
}
