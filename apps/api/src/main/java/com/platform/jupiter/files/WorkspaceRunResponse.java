package com.platform.jupiter.files;

import java.util.List;

public record WorkspaceRunResponse(
        String command,
        int exitCode,
        String stdout,
        String stderr,
        boolean timedOut,
        String summary,
        boolean autoFixApplied,
        List<String> autoFixNotes) {
}
