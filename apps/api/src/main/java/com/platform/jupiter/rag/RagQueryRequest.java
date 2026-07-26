package com.platform.jupiter.rag;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record RagQueryRequest(
        @NotBlank(message = "question is required")
        String question,

        @Min(value = 1, message = "topK must be at least 1")
        @Max(value = 8, message = "topK must be 8 or lower")
        Integer topK) {
}
