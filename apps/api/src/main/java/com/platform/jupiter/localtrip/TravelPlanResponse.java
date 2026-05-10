package com.platform.jupiter.localtrip;

import java.time.Instant;
import java.util.List;

public record TravelPlanResponse(
        Long id,
        String title,
        String region,
        List<String> styles,
        Integer days,
        Integer travelerCount,
        String travelerType,
        String pace,
        String summary,
        String markdown,
        Instant createdAt,
        Instant updatedAt,
        List<TravelPlanItemResponse> items) {
    public static TravelPlanResponse from(TravelPlan plan, List<TravelPlanItem> items) {
        return new TravelPlanResponse(
                plan.getId(),
                plan.getTitle(),
                plan.getRegion(),
                LocalTripText.splitCsv(plan.getStyles()),
                plan.getDays(),
                plan.getTravelerCount(),
                plan.getTravelerType(),
                plan.getPace(),
                plan.getSummary(),
                toMarkdown(plan, items),
                plan.getCreatedAt(),
                plan.getUpdatedAt(),
                items.stream().map(TravelPlanItemResponse::from).toList());
    }

    private static String toMarkdown(TravelPlan plan, List<TravelPlanItem> items) {
        StringBuilder markdown = new StringBuilder();
        markdown.append("# ").append(plan.getTitle()).append("\n\n");
        markdown.append("> ").append(plan.getSummary()).append("\n\n");
        markdown.append("- 지역: ").append(plan.getRegion()).append("\n");
        markdown.append("- 기간: ").append(plan.getDays()).append("일\n");
        markdown.append("- 동행: ").append(plan.getTravelerType()).append(" · ").append(plan.getTravelerCount()).append("명\n");
        markdown.append("- 속도: ").append(plan.getPace()).append("\n");
        markdown.append("- 취향: ").append(plan.getStyles()).append("\n\n");

        int currentDay = -1;
        for (TravelPlanItem item : items) {
            if (item.getDayNumber() == null) {
                continue;
            }
            if (currentDay != item.getDayNumber()) {
                currentDay = item.getDayNumber();
                markdown.append("## Day ").append(currentDay).append("\n\n");
            }
            markdown.append("### ").append(item.getTimeSlot()).append(" · ").append(item.getDestinationName()).append("\n\n");
            markdown.append("- 테마: ").append(item.getPrimaryStyle()).append("\n");
            markdown.append("- 체류: ").append(item.getDurationMinutes()).append("분\n");
            markdown.append("- 메모: ").append(item.getNote()).append("\n\n");
        }
        return markdown.toString().trim();
    }
}
