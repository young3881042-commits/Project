package com.platform.jupiter.localtrip;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TravelPlanItemQualityServiceTest {

    private final TravelPlanItemQualityService service = new TravelPlanItemQualityService(null);

    @Test
    void replacesRepeatedVisitWithUnusedCandidate() {
        TravelPlan plan = plan();
        List<TravelPlanItem> normalized = service.normalize(
                plan,
                List.of(
                        item(1, 1, "09:00-10:00", "경복궁", "관광지"),
                        item(2, 2, "10:00-11:00", "경복궁", "관광지")),
                List.of(destination("창덕궁")),
                false);

        assertEquals(2, normalized.size());
        assertEquals("경복궁", normalized.get(0).getDestinationName());
        assertEquals("창덕궁", normalized.get(1).getDestinationName());
    }

    @Test
    void removesRepeatedVisitWhenNoReplacementExists() {
        TravelPlan plan = plan();
        List<TravelPlanItem> normalized = service.normalize(
                plan,
                List.of(
                        item(1, 1, "09:00-10:00", "경복궁", "관광지"),
                        item(2, 2, "10:00-11:00", "경복궁", "관광지")),
                List.of(),
                false);

        assertEquals(1, normalized.size());
        assertEquals("경복궁", normalized.get(0).getDestinationName());
    }

    private TravelPlan plan() {
        TravelPlan plan = new TravelPlan();
        plan.setRegion("서울");
        return plan;
    }

    private TravelPlanItem item(int day, int sequence, String timeSlot, String destinationName, String primaryStyle) {
        TravelPlanItem item = new TravelPlanItem();
        item.setDayNumber(day);
        item.setSequenceNumber(sequence);
        item.setTimeSlot(timeSlot);
        item.setDestinationName(destinationName);
        item.setRegion("서울");
        item.setPrimaryStyle(primaryStyle);
        item.setNote("관광 방문");
        item.setDurationMinutes(60);
        return item;
    }

    private Destination destination(String name) {
        Destination destination = new Destination();
        destination.setName(name);
        destination.setRegion("서울");
        destination.setDistrict("종로");
        destination.setCategory("관광지");
        destination.setPrimaryStyle("관광지");
        destination.setStyleTags("역사,관광");
        destination.setAddress("서울");
        destination.setHeadline(name);
        destination.setDescription(name + " 방문");
        destination.setRecommendedMinutes(80);
        destination.setPopularityScore(100);
        destination.setSource("db");
        destination.setSourceRef(name);
        return destination;
    }
}
