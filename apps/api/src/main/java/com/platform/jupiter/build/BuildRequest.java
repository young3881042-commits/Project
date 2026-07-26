package com.platform.jupiter.build;

public record BuildRequest(
        String name,
        String description,
        String sourcePath) {
}
