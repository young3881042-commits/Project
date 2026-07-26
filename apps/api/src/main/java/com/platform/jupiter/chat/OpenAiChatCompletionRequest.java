package com.platform.jupiter.chat;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record OpenAiChatCompletionRequest(
        @NotBlank String model,
        @Valid @NotEmpty List<ChatMessage> messages) {
}
