package com.platform.jupiter.rag;

import java.time.Instant;
import java.util.List;

public record RagWorkspaceResponse(
        String question,
        String answer,
        List<RagCitation> citations,
        Instant generatedAt,
        String transcriptPath,
        String title) {
}
