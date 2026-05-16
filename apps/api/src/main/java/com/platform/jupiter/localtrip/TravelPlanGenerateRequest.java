package com.platform.jupiter.localtrip;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;

public record TravelPlanGenerateRequest(
        String region,
        List<String> regions,
        List<Long> destinationIds,
        String style,
        List<String> styles,
        List<String> travelStyle,
        @Min(1) @Max(7) Integer days,
        @Min(1) @Max(12) Integer travelerCount,
        String travelerType,
        String transportType,
        String budgetLevel,
        String pace,
        String memo) {
}
