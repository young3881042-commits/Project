package com.platform.jupiter.travel;

import java.time.LocalDateTime;

public record BatchRunView(
        String runKey,
        String jobName,
        String status,
        String notebookInstance,
        int recordsIn,
        int recordsOut,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        Long durationMs,
        String summaryMessage,
        String elkTraceId) {
}
