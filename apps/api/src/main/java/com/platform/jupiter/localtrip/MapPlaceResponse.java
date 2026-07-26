package com.platform.jupiter.localtrip;

public record MapPlaceResponse(
        String name,
        String address,
        String roadAddress,
        String category,
        String latitude,
        String longitude,
        String source,
        String sourceRef,
        String phone,
        String placeUrl) {

    public MapPlaceResponse(
            String name,
            String address,
            String roadAddress,
            String category,
            String latitude,
            String longitude,
            String source) {
        this(name, address, roadAddress, category, latitude, longitude, source, "", "", "");
    }
}
