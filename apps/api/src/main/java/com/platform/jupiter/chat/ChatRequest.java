package com.platform.jupiter.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ChatRequest(
        @NotBlank String providerId,
        @NotBlank String baseUrl,
        @NotBlank String model,
        String systemPrompt,
        String directoryPath,
        String filePath,
        String title,
        @Valid @NotEmpty List<ChatMessage> messages) {
}
