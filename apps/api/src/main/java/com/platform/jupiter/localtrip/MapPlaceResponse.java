package com.platform.jupiter.localtrip;

public record MapPlaceResponse(
        String name,
        String address,
        String roadAddress,
        String category,
        String latitude,
        String longitude,
        String source) {
}
