package com.platform.jupiter.localtrip;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record DestinationUpsertRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Size(max = 40) String region,
        @NotBlank @Size(max = 80) String district,
        @NotBlank @Size(max = 80) String category,
        @NotBlank @Size(max = 40) String primaryStyle,
        @Size(max = 20) List<@NotBlank @Size(max = 40) String> styleTags,
        @NotBlank @Size(max = 255) String address,
        @NotBlank @Size(max = 255) String headline,
        @Size(max = 512) String imageUrl,
        @NotBlank String description,
        @Min(10) @Max(600) Integer recommendedMinutes,
        @Min(0) @Max(100) Integer popularityScore,
        Double latitude,
        Double longitude,
        @Size(max = 40) String source,
        @Size(max = 80) String sourceRef) {
}
