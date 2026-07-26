package com.platform.jupiter.travel;

import java.time.LocalDateTime;

public record BatchJobStatus(
        String jobKey,
        String jobName,
        String scheduleType,
        String cronExpression,
        String notebookPath,
        String pythonEntrypoint,
        String targetTable,
        String elkIndex,
        String latestRunStatus,
        LocalDateTime latestRunStartedAt,
        Long latestRunDurationMs,
        String latestRunSummary) {
}
