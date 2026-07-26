package com.platform.jupiter.chat;

public record OpenAiChatCompletionChoice(
        int index,
        ChatMessage message,
        String finishReason) {
}
