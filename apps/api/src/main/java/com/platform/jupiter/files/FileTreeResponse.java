package com.platform.jupiter.files;

import java.util.List;

public record FileTreeResponse(String currentPath, String parentPath, List<FileTreeEntry> entries) {
}
