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

            new VerifiedPlace("강릉", "식당", "초당할머니순두부", "강원 강릉시 초당순두부길 77", "초당순두부, 순두부백반, 얼큰째복순두부", "초당동 두부 동선에서 아침이나 점심으로 넣기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "식당", "강릉짬뽕순두부 동화가든 본점", "강원 강릉시 초당순두부길77번길 15", "짬뽕순두부, 초당순두부", "경포·초당권 점심 식사 후보로 쓰기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "식당", "동일장칼국수", "강원 강릉시 강변로534번길 61", "장칼국수, 손만둣국, 전병", "강릉 시내권에서 지역 국수 메뉴를 넣기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "식당", "임계식당", "강원 강릉시 금성로 21 중앙시장 내", "소머리국밥, 돼지국밥, 닭국밥", "중앙시장 주변 아침 식사 후보로 쓰기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "식당", "서지초가뜰", "강원 강릉시 난곡길76번길 43-9", "한정식, 강릉 향토 음식", "오죽헌·선교장 권역과 함께 넣기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "식당", "영진횟집", "강원 강릉시 연곡면 해안로 1427", "활어회, 해산물", "해안 드라이브나 주문진 방향 일정에 맞추기 좋은 실제 음식점", "VISITKOREA"),
            new VerifiedPlace("강릉", "카페", "테라로사 커피공장 강릉본점", "강원 강릉시 구정면 현천길 25", "핸드드립, 커피, 베이커리", "강릉에서 운영되는 대표 로스터리 카페", "VISITKOREA"),
            new VerifiedPlace("강릉", "카페", "보사노바 커피로스터스", "강원 강릉시 창해로14번길 28", "커피, 베이커리", "안목해변 카페거리에서 바다 전망 휴식으로 넣기 좋은 실제 카페", "VISITKOREA"),
            new VerifiedPlace("강릉", "카페", "커피커퍼 박물관 카페", "강원 강릉시 해안로 341", "커피, 음료", "강문해변·초당권 사이에서 커피 휴식과 전시를 함께 잡기 좋은 실제 카페", "VISITKOREA"),
            new VerifiedPlace("전주", "식당", "전주한옥마을 비빔밥 거리", "전북 전주시 완산구 은행로 일대", "전주비빔밥, 콩나물국밥", "한옥마을 주변 대표 식사 동선", "LocalTrip verified"),
            new VerifiedPlace("전주", "식당", "남부시장 야시장", "전북 전주시 완산구 풍남문2길 53", "시장 간식, 전주식 먹거리", "전주 남부시장 중심 야간 먹거리 동선", "LocalTrip verified"),
            new VerifiedPlace("전주", "카페", "객리단길 카페거리", "전북 전주시 완산구 전주객사 일대", "커피, 디저트", "전주 원도심 카페와 식당이 이어지는 실제 상권", "LocalTrip verified"),
            new VerifiedPlace("전주", "카페", "한옥마을 전통찻집", "전북 전주시 완산구 은행로 일대", "전통차, 한과, 디저트", "한옥마을 산책 중 쉬어가기 좋은 찻집 밀집 동선", "LocalTrip verified"),
            new VerifiedPlace("여수", "식당", "이순신광장 먹거리", "전남 여수시 중앙동 일대", "갓김치, 바게트버거, 해산물 간식", "여수 도심 대표 간식과 식사 동선", "LocalTrip verified"),
            new VerifiedPlace("여수", "식당", "여수수산시장", "전남 여수시 여객선터미널길 24", "회, 해산물, 매운탕", "여수항 인근 실제 수산시장 식사 동선", "LocalTrip verified"),
            new VerifiedPlace("여수", "카페", "고소동 벽화마을 카페", "전남 여수시 고소동 일대", "커피, 디저트", "여수 바다 전망과 골목 산책을 연결하는 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("여수", "카페", "오동도 인근 카페", "전남 여수시 수정동 일대", "커피, 음료, 디저트", "오동도 산책 후 쉬어가기 좋은 카페 후보", "LocalTrip verified"),
            new VerifiedPlace("속초", "식당", "속초관광수산시장 먹거리", "강원 속초시 중앙로147번길 12", "닭강정, 오징어순대, 해산물", "속초 대표 시장 먹거리 동선", "LocalTrip verified"),
            new VerifiedPlace("속초", "식당", "아바이마을 식당가", "강원 속초시 청호동 일대", "아바이순대, 함흥냉면", "속초 청호동 실제 식당 밀집 지역", "LocalTrip verified"),
            new VerifiedPlace("속초", "카페", "영랑호 카페", "강원 속초시 영랑호반길 일대", "커피, 디저트", "호수 산책 후 쉬어가기 좋은 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("속초", "카페", "속초해변 카페", "강원 속초시 해오름로 일대", "커피, 베이커리", "속초해변 산책과 연결되는 바다 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("인천", "식당", "차이나타운 중식거리", "인천 중구 차이나타운로 일대", "짜장면, 만두, 공갈빵", "인천 원도심 대표 중식 먹거리 동선", "LocalTrip verified"),
            new VerifiedPlace("인천", "식당", "신포국제시장", "인천 중구 우현로49번길 11-5", "닭강정, 쫄면, 시장 간식", "개항장과 가까운 인천 대표 시장", "LocalTrip verified"),
            new VerifiedPlace("인천", "카페", "개항장 카페거리", "인천 중구 개항로 일대", "커피, 디저트", "근대 건축과 카페가 이어지는 실제 산책 상권", "LocalTrip verified"),
            new VerifiedPlace("인천", "카페", "송도센트럴파크 카페", "인천 연수구 센트럴로 일대", "커피, 브런치", "송도 공원 산책과 연결되는 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("대구", "식당", "서문시장 야시장", "대구 중구 큰장로26길 45", "납작만두, 칼국수, 야시장 간식", "대구 대표 전통시장 먹거리 동선", "LocalTrip verified"),
            new VerifiedPlace("대구", "식당", "동성로 식당가", "대구 중구 동성로 일대", "막창, 분식, 한식", "대구 중심 상권 식사 동선", "LocalTrip verified"),
            new VerifiedPlace("대구", "카페", "김광석길 카페", "대구 중구 달구벌대로 일대", "커피, 디저트", "김광석길 산책 후 쉬어가기 좋은 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("대구", "카페", "수성못 카페거리", "대구 수성구 두산동 일대", "커피, 브런치, 디저트", "호수 산책과 연결되는 대구 대표 카페 권역", "LocalTrip verified"),
            new VerifiedPlace("광주", "식당", "송정역시장 먹거리", "광주 광산구 송정로8번길 13", "상추튀김, 떡갈비, 시장 간식", "광주송정역 인근 대표 시장 먹거리 동선", "LocalTrip verified"),
            new VerifiedPlace("광주", "식당", "동명동 식당가", "광주 동구 동명동 일대", "한식, 브런치, 로컬 메뉴", "국립아시아문화전당과 가까운 실제 식사 상권", "LocalTrip verified"),
            new VerifiedPlace("광주", "카페", "양림동 카페거리", "광주 남구 양림동 일대", "커피, 디저트", "근대 문화마을 산책과 이어지는 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("광주", "카페", "동명동 카페거리", "광주 동구 동명동 일대", "커피, 베이커리", "광주 중심권 로컬 카페 밀집 지역", "LocalTrip verified"),
            new VerifiedPlace("대전", "식당", "성심당 본점", "대전 중구 대종로480번길 15", "튀김소보로, 부추빵, 케이크", "대전 대표 베이커리이자 원도심 먹거리 거점", "LocalTrip verified"),
            new VerifiedPlace("대전", "식당", "중앙시장 먹거리", "대전 동구 대전로 일대", "칼국수, 두부두루치기, 시장 간식", "대전역과 가까운 원도심 식사 동선", "LocalTrip verified"),
            new VerifiedPlace("대전", "카페", "은행동 카페", "대전 중구 은행동 일대", "커피, 디저트", "성심당과 중앙로 주변 카페 동선", "LocalTrip verified"),
            new VerifiedPlace("대전", "카페", "유성온천 카페", "대전 유성구 온천로 일대", "커피, 브런치", "온천 거리 산책 후 쉬어가기 좋은 카페 후보", "LocalTrip verified"),

            new VerifiedPlace("도쿄", "식당", "츠키지 장외시장", "도쿄도 주오구 츠키지 4초메 일대", "스시, 해산물 덮밥, 계란말이", "츠키지 공식 사이트가 소개하는 도쿄 푸드타운", "Tsukiji Outer Market"),
            new VerifiedPlace("도쿄", "식당", "긴자 카가리 본점", "도쿄도 주오구 긴자 6초메 일대", "토리파이탄 라멘, 츠케멘", "긴자 도심 동선에서 쓰기 좋은 실제 라멘 전문점", "LocalTrip verified"),
            new VerifiedPlace("도쿄", "카페", "스타벅스 리저브 로스터리 도쿄", "도쿄도 메구로구 아오바다이 2-19-23", "리저브 커피, 베이커리", "스타벅스 공식 사이트에 등록된 도쿄 로스터리", "Starbucks Reserve"),
            new VerifiedPlace("교토", "식당", "니시키시장", "교토시 나카교구 니시키코지 일대", "교토 반찬, 두부, 말차 디저트", "교토 대표 식재료 시장으로 알려진 실제 시장", "Kyoto food market"),
            new VerifiedPlace("교토", "식당", "오멘 긴카쿠지 본점", "교토시 사쿄구 긴카쿠지 일대", "우동, 계절 채소", "철학의 길과 은각사 동선에서 쓰기 좋은 실제 우동집", "LocalTrip verified"),
            new VerifiedPlace("교토", "식당", "폰토초 식당가", "교토시 나카교구 폰토초 일대", "교토식 가정식, 야키토리, 가이세키 후보", "가모가와와 기온 산책 뒤 저녁 식사 후보를 찾기 좋은 실제 식당가", "Kyoto Travel"),
            new VerifiedPlace("교토", "식당", "기온 식당가", "교토시 히가시야마구 기온마치 일대", "소바, 교토식 정식, 디저트", "기요미즈데라와 야사카신사 동선에서 쓰기 좋은 실제 식사 권역", "Kyoto Travel"),
            new VerifiedPlace("교토", "카페", "이노다커피 본점", "교토시 나카교구 사카이마치도리 산조사가루", "커피, 모닝 세트", "교토 도심의 실제 운영 클래식 카페", "LocalTrip verified"),
            new VerifiedPlace("교토", "카페", "아라비카 교토 아라시야마", "교토시 우쿄구 사가텐류지 스스키노바바초 일대", "커피, 라테", "아라시야마 강변 산책 중 쉬어가기 좋은 실제 카페 후보", "LocalTrip verified"),
            new VerifiedPlace("교토", "카페", "스마트 커피", "교토시 나카교구 테라마치도리 일대", "커피, 핫케이크, 프렌치토스트", "니시키시장과 가와라마치 동선에서 쉬어가기 좋은 클래식 카페 후보", "LocalTrip verified"),
            new VerifiedPlace("오사카", "식당", "도톤보리", "오사카시 주오구 도톤보리 일대", "타코야키, 오코노미야키, 쿠시카츠", "오사카 대표 먹거리 거리", "Osaka tourism"),
            new VerifiedPlace("오사카", "식당", "구로몬시장", "오사카시 주오구 닛폰바시 2초메 일대", "참치, 해산물 구이, 길거리 간식", "난바 근처 식도락 동선에 쓰기 좋은 실제 시장", "LocalTrip verified"),
            new VerifiedPlace("오사카", "식당", "미즈노", "오사카시 주오구 도톤보리 일대", "오코노미야키, 야키소바", "도톤보리 저녁 동선에서 쓰기 좋은 실제 오코노미야키 후보", "LocalTrip verified"),
            new VerifiedPlace("오사카", "식당", "쿠시카츠 다루마 도톤보리 권역", "오사카시 주오구 도톤보리 일대", "쿠시카츠, 도테야키", "오사카식 튀김을 맛볼 수 있는 도톤보리 식사 후보", "Osaka tourism"),
            new VerifiedPlace("오사카", "카페", "브루클린 로스팅 컴퍼니 기타하마", "오사카시 주오구 기타하마 2초메 일대", "커피, 베이커리", "오사카 기타하마 강변의 실제 운영 카페", "LocalTrip verified"),
            new VerifiedPlace("오사카", "카페", "SOT COFFEE Osaka Kitahama", "오사카시 주오구 아와지마치 1초메 일대", "스페셜티 커피, 라테, 디저트", "기타하마·나카노시마 산책 중 쉬어가기 좋은 실제 카페", "SOT COFFEE"),
            new VerifiedPlace("오사카", "카페", "리쿠로오지상 난바 본점", "오사카시 주오구 난바 일대", "치즈케이크, 커피", "난바 숙소권에서 간단히 디저트와 휴식을 넣기 좋은 실제 베이커리 후보", "LocalTrip verified"),
            new VerifiedPlace("후쿠오카", "식당", "나카스 포장마차 거리", "후쿠오카시 하카타구 나카스 일대", "하카타 라멘, 야키토리, 오뎅", "후쿠오카 대표 야타이 식사 동선", "Fukuoka tourism"),
            new VerifiedPlace("후쿠오카", "식당", "하카타 잇소우 본점", "후쿠오카시 하카타구 하카타에키히가시 3초메 일대", "하카타 돈코츠 라멘, 교자", "하카타역 동선에서 쓰기 좋은 실제 라멘 전문점", "LocalTrip verified"),
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
