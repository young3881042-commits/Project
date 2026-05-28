package com.platform.jupiter.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AuthSignupRequest(
        @NotBlank
        @Size(max = 40)
        @Pattern(regexp = "[a-zA-Z0-9._-]+", message = "username must match [a-zA-Z0-9._-]+")
        String username,
        @NotBlank
        @Size(max = 100)
        String password) {
}
