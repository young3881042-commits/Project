package com.platform.jupiter.files;

public record WorkspaceLlmConfigResponse(
        String defaultOpenAiModel,
        boolean openAiConfigured,
        boolean codexCliModeEnabled,
        String openAiMessage,
        String codexMessage) {
}
