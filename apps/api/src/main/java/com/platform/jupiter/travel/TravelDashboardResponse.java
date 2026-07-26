package com.platform.jupiter.travel;

import java.util.List;

public record TravelDashboardResponse(
        TravelSummary summary,
        List<RegionPerformance> regions,
        List<DistrictPerformance> districts,
        List<PlaceSnapshot> places,
        List<TravelTrendPoint> trends,
        List<BatchJobStatus> jobs,
        List<BatchRunView> recentRuns,
        List<BatchEventView> recentEvents) {
}
