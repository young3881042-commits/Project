package com.platform.jupiter.build;

import java.time.Instant;

public record BuildRecordDto(
        long id,
        String name,
        String description,
        String sourcePath,
        String status,
        Instant createdAt) {
}
