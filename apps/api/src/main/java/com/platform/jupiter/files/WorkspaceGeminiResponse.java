package com.platform.jupiter.files;

import java.util.List;

public record WorkspaceGeminiResponse(
        String providerId,
        String model,
        String prompt,
        String output,
        String workingDirectory,
        int exitCode,
        boolean timedOut,
        List<String> contextFiles) {
}
