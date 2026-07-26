package com.platform.jupiter.chat;

import java.util.List;

public record OpenAiChatCompletionResponse(
        String id,
        String object,
        long created,
        String model,
        List<OpenAiChatCompletionChoice> choices) {
}
