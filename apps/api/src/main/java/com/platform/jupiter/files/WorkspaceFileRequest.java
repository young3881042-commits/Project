package com.platform.jupiter.files;

import jakarta.validation.constraints.NotBlank;

public record WorkspaceFileRequest(
        @NotBlank String path,
        String content) {
}
