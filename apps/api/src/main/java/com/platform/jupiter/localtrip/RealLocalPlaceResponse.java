package com.platform.jupiter.localtrip;

public record RealLocalPlaceResponse(
        String name,
        String address,
        String roadAddress,
        String region,
        String category,
        String recommendedMenu,
        String verificationNote,
        String source,
        String sourceRef,
        String phone,
        String placeUrl,
        String latitude,
        String longitude) {

    static RealLocalPlaceResponse fromDestination(Destination destination) {
        return new RealLocalPlaceResponse(
                destination.getName(),
                destination.getAddress(),
                "",
                destination.getRegion(),
                normalizeCategory(destination.getPrimaryStyle()),
                "",
                destination.getDescription(),
                destination.getSource(),
                destination.getSourceRef(),
                "",
                "",
                "",
                "");
    }

    static RealLocalPlaceResponse fromMapPlace(MapPlaceResponse place, String region, String category) {
        return new RealLocalPlaceResponse(
                place.name(),
                place.address(),
                place.roadAddress(),
                region,
                category,
                "",
                "Kakao Local keyword search result.",
                place.source(),
                place.sourceRef(),
                place.phone(),
                place.placeUrl(),
                place.latitude(),
                place.longitude());
    }

    static RealLocalPlaceResponse fromCatalog(VerifiedLocalPlaceCatalog.VerifiedPlace place) {
        return new RealLocalPlaceResponse(
                place.name(),
                place.address(),
                "",
                place.region(),
                place.category(),
                place.recommendedMenu(),
                place.verificationNote(),
                place.sourceLabel(),
                "",
                "",
                "",
                "",
                "");
    }

    private static String normalizeCategory(String value) {
        String normalized = LocalTripText.normalize(value);
        return normalized.contains("카페") || normalized.contains("디저트") || normalized.contains("브런치") ? "카페" : "식당";
    }
}
