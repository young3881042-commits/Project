package com.platform.jupiter.rag;

public record RagCitation(
        String documentId,
        String documentTitle,
        int chunkIndex,
        double score,
        String excerpt) {
}
