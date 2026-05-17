package com.platform.jupiter.localtrip;

import java.util.List;

final class VerifiedLocalPlaceCatalog {
    private static final List<VerifiedPlace> PLACES = List.of(
            new VerifiedPlace("서울", "식당", "광장시장 먹자골목", "서울 종로구 창경궁로 88 일대", "빈대떡, 마약김밥, 육회", "서울 공식 관광 정보에 등록된 전통시장 먹거리 동선", "Visit Seoul"),
            new VerifiedPlace("서울", "식당", "망원시장", "서울 마포구 포은로8길 일대", "닭강정, 고로케, 시장 간식", "서울 공식 관광 정보에 등록된 로컬 시장", "Visit Seoul"),
            new VerifiedPlace("서울", "카페", "카페 어니언 안국", "서울 종로구 계동길 5", "커피, 베이커리, 페이스트리", "한국관광공사/서울관광재단에 등록된 한옥 카페", "VISITKOREA"),
            new VerifiedPlace("서울", "카페", "오설록 티하우스 북촌", "서울 종로구 북촌로 일대", "녹차 음료, 티 디저트", "오설록 브랜드가 운영하는 북촌 티하우스", "OSULLOC"),

            new VerifiedPlace("경주", "식당", "교리김밥 본점", "경북 경주시 교촌안길 27-42", "교리김밥, 잔치국수", "한국관광공사 김밥 미식 콘텐츠에 언급된 경주 대표 김밥집", "VISITKOREA"),
            new VerifiedPlace("경주", "식당", "함양집 보불로점", "경북 경주시 보불로 287", "한우물회, 육회비빔밥", "경주 보문·불국사 동선에서 쓰기 좋은 지역 음식점", "LocalTrip verified"),
            new VerifiedPlace("경주", "카페", "황남빵 본점", "경북 경주시 태종로 783", "황남빵, 찰보리빵", "한국관광공사에 소개된 1939년 시작 경주 대표 베이커리", "VISITKOREA"),
            new VerifiedPlace("경주", "카페", "카페 능", "경북 경주시 포석로 일대", "커피, 계절 디저트", "황리단길·교촌마을 동선의 실제 운영 카페", "LocalTrip verified"),

            new VerifiedPlace("부산", "식당", "국제시장 먹자골목", "부산 중구 국제시장2길 일대", "비빔당면, 충무김밥, 씨앗호떡", "한국관광공사에 등록된 60년 이상 전통의 먹자골목", "VISITKOREA"),
            new VerifiedPlace("부산", "식당", "자갈치시장 회센터", "부산 중구 자갈치해안로 52", "회, 생선구이, 해산물", "부산 대표 수산시장 식사 동선", "VISIT BUSAN"),
            new VerifiedPlace("부산", "카페", "전포카페거리", "부산 부산진구 전포대로 일대", "커피, 디저트", "부산 도심 카페 밀집 거리", "VISIT BUSAN"),
            new VerifiedPlace("부산", "카페", "웨이브온 커피", "부산 기장군 장안읍 해맞이로 286", "커피, 베이커리", "기장 해안 드라이브 동선의 실제 운영 카페", "LocalTrip verified"),

            new VerifiedPlace("제주", "식당", "동문재래시장 먹거리", "제주 제주시 관덕로14길 20", "고기국수, 오메기떡, 해산물 간식", "제주 대표 전통시장 먹거리 동선", "VISIT JEJU"),
            new VerifiedPlace("제주", "식당", "명진전복", "제주 제주시 구좌읍 해맞이해안로 1282", "전복돌솥밥, 전복구이", "제주 동부 해안 동선의 실제 운영 음식점", "LocalTrip verified"),
            new VerifiedPlace("제주", "카페", "오설록 티뮤지엄", "제주 서귀포시 안덕면 신화역사로 15", "녹차 아이스크림, 티 세트", "오설록 공식 사이트에 소개된 제주 티뮤지엄", "OSULLOC"),
            new VerifiedPlace("제주", "카페", "애월카페거리", "제주 제주시 애월읍 애월해안로 일대", "커피, 디저트", "애월 해안 드라이브와 연결되는 실제 카페 밀집 거리", "LocalTrip verified"),

            new VerifiedPlace("도쿄", "식당", "츠키지 장외시장", "도쿄도 주오구 츠키지 4초메 일대", "스시, 해산물 덮밥, 계란말이", "츠키지 공식 사이트가 소개하는 도쿄 푸드타운", "Tsukiji Outer Market"),
            new VerifiedPlace("도쿄", "카페", "스타벅스 리저브 로스터리 도쿄", "도쿄도 메구로구 아오바다이 2-19-23", "리저브 커피, 베이커리", "스타벅스 공식 사이트에 등록된 도쿄 로스터리", "Starbucks Reserve"),
            new VerifiedPlace("교토", "식당", "니시키시장", "교토시 나카교구 니시키코지 일대", "교토 반찬, 두부, 말차 디저트", "교토 대표 식재료 시장으로 알려진 실제 시장", "Kyoto food market"),
            new VerifiedPlace("교토", "카페", "이노다커피 본점", "교토시 나카교구 사카이마치도리 산조사가루", "커피, 모닝 세트", "교토 도심의 실제 운영 클래식 카페", "LocalTrip verified"),
            new VerifiedPlace("오사카", "식당", "도톤보리", "오사카시 주오구 도톤보리 일대", "타코야키, 오코노미야키, 쿠시카츠", "오사카 대표 먹거리 거리", "Osaka tourism"),
            new VerifiedPlace("오사카", "카페", "브루클린 로스팅 컴퍼니 기타하마", "오사카시 주오구 기타하마 2초메 일대", "커피, 베이커리", "오사카 기타하마 강변의 실제 운영 카페", "LocalTrip verified"),
            new VerifiedPlace("후쿠오카", "식당", "나카스 포장마차 거리", "후쿠오카시 하카타구 나카스 일대", "하카타 라멘, 야키토리, 오뎅", "후쿠오카 대표 야타이 식사 동선", "Fukuoka tourism"),
            new VerifiedPlace("후쿠오카", "카페", "REC COFFEE 야쿠인에키마에점", "후쿠오카시 주오구 시로가네 1초메 일대", "스페셜티 커피, 라테", "후쿠오카에서 실제 운영되는 로컬 커피 브랜드", "LocalTrip verified")
    );

    private VerifiedLocalPlaceCatalog() {
    }

    static VerifiedPlace pick(String regionLabel, String primaryStyle, int dayNumber, int sequenceNumber) {
        String style = normalizeStyle(primaryStyle);
        List<VerifiedPlace> regionPlaces = PLACES.stream()
                .filter(place -> containsRegion(regionLabel, place.region()))
                .filter(place -> place.category().equals(style))
                .toList();
        List<VerifiedPlace> candidates = regionPlaces.isEmpty()
                ? PLACES.stream().filter(place -> place.category().equals(style)).toList()
                : regionPlaces;
        if (candidates.isEmpty()) {
            return null;
        }
        int index = Math.floorMod((dayNumber - 1) + sequenceNumber, candidates.size());
        return candidates.get(index);
    }

    private static boolean containsRegion(String regionLabel, String region) {
        String normalized = LocalTripText.normalize(regionLabel);
        return normalized.isBlank()
                || normalized.contains(region)
                || region.contains(normalized)
                || (normalized.contains("tokyo") && "도쿄".equals(region))
                || (normalized.contains("kyoto") && "교토".equals(region))
                || (normalized.contains("osaka") && "오사카".equals(region))
                || (normalized.contains("fukuoka") && "후쿠오카".equals(region));
    }

    private static String normalizeStyle(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.contains("카페") || normalized.contains("디저트") || normalized.contains("브런치") ? "카페" : "식당";
    }

    record VerifiedPlace(
            String region,
            String category,
            String name,
            String address,
            String recommendedMenu,
            String verificationNote,
            String sourceLabel) {
    }
}
