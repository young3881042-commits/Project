package com.platform.jupiter.web;

public record OverviewResponse(
        String baseImage,
        String jupyterUrl,
        String frontendUrl,
        String apiUrl,
        String gatewayUrl,
        String externalHost,
        long buildCount,
        int snapshotCount,
        long notebookCount) {
}
