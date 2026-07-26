package com.platform.jupiter.localtrip;

public record TourApiDestination(
        String contentId,
        String title,
        String contentTypeId,
        String areaName,
        String address,
        String category,
        String imageUrl) {
}
