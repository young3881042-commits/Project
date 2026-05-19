package com.platform.jupiter.localtrip;

public record DailyRouteRequest(
        Integer day,
        String startPlace,
        String startAddress,
        String endPlace,
        String endAddress,
        String departureTime,
        String arrivalTime) {
}
