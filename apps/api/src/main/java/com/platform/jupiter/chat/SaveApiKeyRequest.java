package com.platform.jupiter.chat;

import jakarta.validation.constraints.NotBlank;

public record SaveApiKeyRequest(@NotBlank String apiKey) {
}
