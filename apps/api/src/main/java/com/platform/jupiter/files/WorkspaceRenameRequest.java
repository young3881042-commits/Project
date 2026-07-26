package com.platform.jupiter.files;

import jakarta.validation.constraints.NotBlank;

public record WorkspaceRenameRequest(
        @NotBlank String path,
        @NotBlank String newName) {
}
