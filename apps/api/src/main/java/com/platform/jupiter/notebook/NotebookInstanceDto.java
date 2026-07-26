package com.platform.jupiter.notebook;

import java.time.Instant;

public record NotebookInstanceDto(
        Long id,
        String slug,
        String imageTag,
        String imageName,
        String displayName,
        String accessUrl,
        String accessToken,
        String status,
        Instant createdAt,
        Instant updatedAt) {
    public static NotebookInstanceDto from(NotebookInstance instance) {
        return new NotebookInstanceDto(
                instance.getId(),
                instance.getSlug(),
                instance.getImageTag(),
                instance.getImageName(),
                instance.getDisplayName(),
                instance.getAccessUrl(),
                instance.getAccessToken(),
                instance.getStatus(),
                instance.getCreatedAt(),
                instance.getUpdatedAt());
    }
}
