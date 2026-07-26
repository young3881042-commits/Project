package com.platform.jupiter.localtrip;

import java.time.Instant;

public record ApiSyncLogResponse(
        Long id,
        String provider,
        String syncType,
        String status,
        Integer recordsInserted,
        Integer recordsUpdated,
        String requestUrl,
        String message,
        String errorDetail,
        Instant startedAt,
        Instant endedAt) {
    public static ApiSyncLogResponse from(ApiSyncLog log) {
        return new ApiSyncLogResponse(
                log.getId(),
                log.getProvider(),
                log.getSyncType(),
                log.getStatus(),
                log.getRecordsInserted(),
                log.getRecordsUpdated(),
                log.getRequestUrl(),
                log.getMessage(),
                log.getErrorDetail(),
                log.getStartedAt(),
                log.getEndedAt());
    }
}
