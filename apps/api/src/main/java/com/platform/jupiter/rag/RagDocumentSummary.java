package com.platform.jupiter.rag;

import java.time.Instant;

public record RagDocumentSummary(
        String id,
        String title,
        String filename,
        String contentType,
        long size,
        Instant uploadedAt,
        int chunkCount,
        String preview) {
}
