package com.platform.jupiter.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AccountPasswordUpdateRequest(
        @NotBlank
        @Size(max = 100)
        String currentPassword,
        @NotBlank
        @Size(max = 100)
        String newPassword) {
}
