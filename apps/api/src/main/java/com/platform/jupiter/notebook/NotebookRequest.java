package com.platform.jupiter.notebook;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record NotebookRequest(
        @NotBlank
        @Pattern(regexp = "[a-z0-9._-]+", message = "imageTag must match [a-z0-9._-]+")
        String imageTag,
        @Size(max = 100)
        String displayName) {
}
