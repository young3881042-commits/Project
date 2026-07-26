package com.platform.jupiter.files;

import java.time.Instant;

public record WorkspaceExecutionLogDto(
        String id,
        String type,
        String targetPath,
        String command,
        int exitCode,
        boolean timedOut,
        String output,
        Instant executedAt) {
}
