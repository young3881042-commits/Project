package com.platform.jupiter.files;

import java.time.Instant;
import java.util.List;

public record SnapshotDto(
        String tag,
        String image,
        String baseImage,
        String pipPackages,
        String note,
        List<String> workspaceFiles,
        Instant createdAt) {
}
