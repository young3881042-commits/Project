package com.platform.jupiter.travel;

import java.time.LocalDateTime;

public record BatchEventView(
        LocalDateTime eventTime,
        String jobName,
        String runKey,
        String logLevel,
        String stepName,
        String message,
        String payloadJson) {
}
