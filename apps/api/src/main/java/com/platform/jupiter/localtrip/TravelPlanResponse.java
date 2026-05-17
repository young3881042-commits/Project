package com.platform.jupiter.localtrip;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public record TravelPlanResponse(
        Long id,
        String title,
        String region,
        List<String> styles,
        Integer days,
        Integer travelerCount,
        String travelerType,
        String pace,
        String startPlace,
        String startAddress,
        String endPlace,
        String endAddress,
        String departureTime,
        String arrivalTime,
        String estimatedBudget,
        String summary,
        String markdown,
        Instant createdAt,
        Instant updatedAt,
        List<TravelPlanDayResponse> dayCards,
        List<TravelPlanItemResponse> items) {
    public static TravelPlanResponse from(TravelPlan plan, List<TravelPlanItem> items) {
        return from(plan, items, List.of());
    }

    public static TravelPlanResponse from(TravelPlan plan, List<TravelPlanItem> items, List<Destination> destinations) {
        Map<Long, Destination> destinationById = destinations.stream()
                .filter(destination -> destination.getId() != null)
                .collect(Collectors.toMap(Destination::getId, Function.identity(), (left, right) -> left));
        return new TravelPlanResponse(
                plan.getId(),
                plan.getTitle(),
                plan.getRegion(),
                LocalTripText.splitCsv(plan.getStyles()),
                plan.getDays(),
                plan.getTravelerCount(),
                plan.getTravelerType(),
                plan.getPace(),
                plan.getStartPlace(),
                plan.getStartAddress(),
                plan.getEndPlace(),
                plan.getEndAddress(),
                plan.getDepartureTime(),
                plan.getArrivalTime(),
                plan.getEstimatedBudget(),
                plan.getSummary(),
                toMarkdown(plan, items),
                plan.getCreatedAt(),
                plan.getUpdatedAt(),
                toDayCards(items, destinationById),
                items.stream()
                        .map(item -> TravelPlanItemResponse.from(item, destinationById.get(item.getDestinationId())))
                        .toList());
    }

    private static List<TravelPlanDayResponse> toDayCards(List<TravelPlanItem> items, Map<Long, Destination> destinationById) {
        Map<Integer, List<TravelPlanItem>> grouped = items.stream()
                .filter(item -> item.getDayNumber() != null)
                .sorted(Comparator.comparing(TravelPlanItem::getDayNumber).thenComparing(TravelPlanItem::getSequenceNumber))
                .collect(Collectors.groupingBy(TravelPlanItem::getDayNumber, LinkedHashMap::new, Collectors.toList()));
        return grouped.entrySet().stream()
                .map(entry -> new TravelPlanDayResponse(
                        entry.getKey(),
                        entry.getKey() + "일차",
                        entry.getValue().stream()
                                .map(TravelPlanItem::getDestinationName)
                                .distinct()
                                .limit(3)
                                .collect(Collectors.joining(" · ")),
                        entry.getValue().stream()
                                .map(item -> TravelPlanItemResponse.from(item, destinationById.get(item.getDestinationId())))
                                .toList()))
                .toList();
    }

    private static String toMarkdown(TravelPlan plan, List<TravelPlanItem> items) {
        StringBuilder markdown = new StringBuilder();
        markdown.append("# ").append(plan.getTitle()).append("\n\n");
        markdown.append("> ").append(plan.getSummary()).append("\n\n");
        markdown.append("- 지역: ").append(plan.getRegion()).append("\n");
        markdown.append("- 기간: ").append(plan.getDays()).append("일\n");
        markdown.append("- 동행: ").append(plan.getTravelerType()).append(" · ").append(plan.getTravelerCount()).append("명\n");
        markdown.append("- 속도: ").append(plan.getPace()).append("\n");
        if (hasText(plan.getStartPlace()) || hasText(plan.getStartAddress())) {
            markdown.append("- 출발: ").append(defaultText(plan.getStartPlace(), "출발지"))
                    .append(hasText(plan.getStartAddress()) ? " · " + plan.getStartAddress() : "")
                    .append(hasText(plan.getDepartureTime()) ? " · " + plan.getDepartureTime() : "")
                    .append("\n");
        }
        if (hasText(plan.getEndPlace()) || hasText(plan.getEndAddress())) {
            markdown.append("- 도착: ").append(defaultText(plan.getEndPlace(), "최종 목적지"))
                    .append(hasText(plan.getEndAddress()) ? " · " + plan.getEndAddress() : "")
                    .append(hasText(plan.getArrivalTime()) ? " · " + plan.getArrivalTime() : "")
                    .append("\n");
        }
        if (hasText(plan.getEstimatedBudget())) {
            markdown.append("- 예상 예산: ").append(plan.getEstimatedBudget()).append("\n");
        }
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

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String defaultText(String value, String fallback) {
        return hasText(value) ? value : fallback;
    }
}
