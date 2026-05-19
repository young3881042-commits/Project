package com.platform.jupiter.localtrip;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

final class LocalTripImageCatalog {
    private static final String COMMON_FOOD_CAFE_IMAGE = image("Cafe storefront in Seongsu-dong.jpg");
    private static final Map<String, String> SOURCE_REF_IMAGES = Map.ofEntries(
            Map.entry("SEOUL-001", image("Gyeongbokgung Palace Main Gate.jpg")),
            Map.entry("SEOUL-002", image("Bukchon Hanok Village 05.jpg")),
            Map.entry("SEOUL-003", image("Cafe storefront in Seongsu-dong.jpg")),
            Map.entry("SEOUL-004", image("Mercado Mangwon en Seúl.jpg")),
            Map.entry("SEOUL-005", image("Yeouido, Seoul.jpg")),
            Map.entry("SEOUL-006", image("N Seoul Tower a4.jpg")),
            Map.entry("SEOUL-007", image("20240601 144028 Dongdaemun Design Plaza, Seoul 08.jpg")),
            Map.entry("SEOUL-008", image("KOCIS Cheonggyecheon (stream) in Seoul (7085882037).jpg")),
            Map.entry("GYEONGJU-001", image("Bulguksa temple main building.jpg")),
            Map.entry("GYEONGJU-002", image("Donggung Palace and Wolji Pond in Gyeongju.jpg")),
            Map.entry("GYEONGJU-003", image("Cheomseongdae, Gyeongju.jpg")),
            Map.entry("GYEONGJU-004", image("Street in Gyeongju.jpg")),
            Map.entry("GYEONGJU-005", image("Bomun Lake.jpg")),
            Map.entry("GYEONGJU-006", image("Gyochon Village 1.jpg")),
            Map.entry("GYEONGJU-007", image("Woljeonggyo Bridge.jpg")),
            Map.entry("GYEONGJU-008", image("Daereungwon Tomb Complex.jpg")),
            Map.entry("BUSAN-001", image("Gamcheon culture village.jpg")),
            Map.entry("BUSAN-002", image("Haeundae Beach Busan (45698772312).jpg")),
            Map.entry("BUSAN-003", image("Gwangalli Beach in Busan.jpg")),
            Map.entry("BUSAN-004", image("Gukje Market.jpg")),
            Map.entry("BUSAN-005", image("Seomyeon Street.jpg")),
            Map.entry("BUSAN-006", image("Taejongdae in Busan.jpg")),
            Map.entry("BUSAN-007", image("Jagalchi Market Busan.jpg")),
            Map.entry("BUSAN-008", image("Oryukdo Skywalk.jpg")),
            Map.entry("JEJU-001", image("Seongsan Ilchulbong 01.jpg")),
            Map.entry("JEJU-002", image("Udo, Jeju Province, South Korea 01.jpg")),
            Map.entry("JEJU-003", image("Hyeop-jae Beach.jpg")),
            Map.entry("JEJU-004", image("Jeju dongmun market 1.JPG")),
            Map.entry("JEJU-005", image("Aewol in Jeju island.jpg")),
            Map.entry("JEJU-006", image("Bijarim forest, Jeju.jpg")),
            Map.entry("JEJU-007", image("Hallasan Mountain.jpg")),
            Map.entry("JEJU-008", image("Eco-Pond, Camellia Hill, Jeju (생태연못, 제주 카멜리아힐) - panoramio.jpg")),
            Map.entry("TOKYO-001", image("Five-storied Pagoda of Sensoji Temple in Tokyo, 20240824 1103 5615.jpg")),
            Map.entry("TOKYO-002", image("Shibuya Sky 2023.jpg")),
            Map.entry("TOKYO-003", image("Tsukiji Outer Market 2018.jpg")),
            Map.entry("TOKYO-004", image("Shinjuku Gyoen National Garden and NTT DoCoMo Yoyogi Building, Tokyo, Japan.jpg")),
            Map.entry("TOKYO-005", image("Ueno Park Tokyo Japan.jpg")),
            Map.entry("TOKYO-006", image("Takeshita Street 2019.jpg")),
            Map.entry("TOKYO-007", image("Odaiba Marine Park.jpg")),
            Map.entry("TOKYO-008", image("Meiji Shrine Torii.jpg")),
            Map.entry("KYOTO-001", image("Nio-mon, Kiyomizu-dera Temple, Kyoto, West view 20190416 2.jpg")),
            Map.entry("KYOTO-002", image("Fushimi Inari Taisha, Kyoto, Japan.jpg")),
            Map.entry("KYOTO-003", image("Nishiki Market, Kyoto 2019.jpg")),
            Map.entry("KYOTO-004", image("Bamboo Forest, Arashiyama, Kyoto, Japan.jpg")),
            Map.entry("KYOTO-005", image("Gion Kyoto Japan.jpg")),
            Map.entry("KYOTO-006", image("Kinkaku-ji the Golden Pavilion in Kyoto overlooking the lake - high rez.JPG")),
            Map.entry("KYOTO-007", image("Philosopher's Walk Kyoto.jpg")),
            Map.entry("KYOTO-008", image("Kyoto Station 2018.jpg")),
            Map.entry("OSAKA-001", image("Dotonbori, Osaka, at night, November 2016.jpg")),
            Map.entry("OSAKA-002", image("Osaka Castle 02bs3200.jpg")),
            Map.entry("OSAKA-003", image("Shinsaibashi-suji Shopping Street 2014.jpg")),
            Map.entry("OSAKA-004", image("Umeda Sky Building Osaka Japan.jpg")),
            Map.entry("OSAKA-005", image("Tempozan Ferris Wheel Osaka Japan.jpg")),
            Map.entry("OSAKA-006", image("Kuromon Ichiba Market 2014.jpg")),
            Map.entry("FUKUOKA-001", image("Ohori Park Fukuoka.jpg")),
            Map.entry("FUKUOKA-002", image("Nakasu yatai Fukuoka.jpg")),
            Map.entry("FUKUOKA-003", image("Dazaifu Tenmangu 2016.jpg")),
            Map.entry("FUKUOKA-004", image("Momochi Seaside Park Fukuoka.jpg")),
            Map.entry("FUKUOKA-005", image("Canal City Hakata 2019.jpg")),
            Map.entry("FUKUOKA-006", image("Marine World Uminonakamichi.jpg")));

    private static final Map<String, String> NAME_IMAGES = Map.ofEntries(
            Map.entry("경복궁", SOURCE_REF_IMAGES.get("SEOUL-001")),
            Map.entry("북촌한옥마을", SOURCE_REF_IMAGES.get("SEOUL-002")),
            Map.entry("성수카페거리", SOURCE_REF_IMAGES.get("SEOUL-003")),
            Map.entry("망원시장", SOURCE_REF_IMAGES.get("SEOUL-004")),
            Map.entry("여의도한강공원", SOURCE_REF_IMAGES.get("SEOUL-005")),
            Map.entry("남산서울타워", SOURCE_REF_IMAGES.get("SEOUL-006")),
            Map.entry("동대문디자인플라자", SOURCE_REF_IMAGES.get("SEOUL-007")),
            Map.entry("청계천", SOURCE_REF_IMAGES.get("SEOUL-008")),
            Map.entry("불국사", SOURCE_REF_IMAGES.get("GYEONGJU-001")),
            Map.entry("동궁과월지", SOURCE_REF_IMAGES.get("GYEONGJU-002")),
            Map.entry("첨성대", SOURCE_REF_IMAGES.get("GYEONGJU-003")),
            Map.entry("황리단길", SOURCE_REF_IMAGES.get("GYEONGJU-004")),
            Map.entry("보문호수", SOURCE_REF_IMAGES.get("GYEONGJU-005")),
            Map.entry("교촌마을", SOURCE_REF_IMAGES.get("GYEONGJU-006")),
            Map.entry("월정교", SOURCE_REF_IMAGES.get("GYEONGJU-007")),
            Map.entry("대릉원", SOURCE_REF_IMAGES.get("GYEONGJU-008")),
            Map.entry("감천문화마을", SOURCE_REF_IMAGES.get("BUSAN-001")),
            Map.entry("해운대해수욕장", SOURCE_REF_IMAGES.get("BUSAN-002")),
            Map.entry("광안리해변", SOURCE_REF_IMAGES.get("BUSAN-003")),
            Map.entry("국제시장", SOURCE_REF_IMAGES.get("BUSAN-004")),
            Map.entry("전포카페거리", SOURCE_REF_IMAGES.get("BUSAN-005")),
            Map.entry("태종대", SOURCE_REF_IMAGES.get("BUSAN-006")),
            Map.entry("자갈치시장", SOURCE_REF_IMAGES.get("BUSAN-007")),
            Map.entry("오륙도스카이워크", SOURCE_REF_IMAGES.get("BUSAN-008")),
            Map.entry("성산일출봉", SOURCE_REF_IMAGES.get("JEJU-001")),
            Map.entry("우도", SOURCE_REF_IMAGES.get("JEJU-002")),
            Map.entry("협재해변", SOURCE_REF_IMAGES.get("JEJU-003")),
            Map.entry("동문시장", SOURCE_REF_IMAGES.get("JEJU-004")),
            Map.entry("애월카페거리", SOURCE_REF_IMAGES.get("JEJU-005")),
            Map.entry("절물자연휴양림", SOURCE_REF_IMAGES.get("JEJU-006")),
            Map.entry("한라산성판악", SOURCE_REF_IMAGES.get("JEJU-007")),
            Map.entry("카멜리아힐", SOURCE_REF_IMAGES.get("JEJU-008")),
            Map.entry("석굴암", image("Front view of Seokguram from front chamber.jpg")),
            Map.entry("국립경주박물관", image("Gyeongju National Museum.jpg")),
            Map.entry("경주월드", image("Entrance of Gyeongju World and Draken.jpg")),
            Map.entry("양동마을", image("Yangdong Village 02.jpg")),
            Map.entry("흰여울문화마을", image("Stairway at Huinnyeoul Culture Village in Busan, South Korea.jpg")),
            Map.entry("동백섬", image("Dongbaekseom, Busan (2).jpg")),
            Map.entry("다대포해수욕장", image("Dadaepo Beach, Busan, Korea.jpg")),
            Map.entry("송정해변", image("Songjeong Beach.jpg")),
            Map.entry("창덕궁", image("Exterior view of Seongjeonggak with blue sky at Changdeokgung Palace in Seoul.jpg")),
            Map.entry("광장시장", image("Gwangjang Market, Seoul 02.jpg")),
            Map.entry("서울숲", image("SeoulForest.jpg")),
            Map.entry("익선동한옥거리", image("Ikseon-dong 익선동 October 1 2020 6.jpg")),
            Map.entry("연남동경의선숲길", image("Gyeonguiseon Forest Trail Park and Ttaeng-ttaeng Street in Seoul (near Hongdae, 1).jpg")),
            Map.entry("덕수궁돌담길", image("Road of Deoksugung.jpg")),
            Map.entry("사려니숲길", image("사려니숲길 외부 모습.jpg")),
            Map.entry("천지연폭포", image("Cheonjiyeon Waterfall (14523691134).jpg")),
            Map.entry("오설록티뮤지엄", image("Osulloc Tea Museum & Fields, Jeju.jpg")),
            Map.entry("센소지", SOURCE_REF_IMAGES.get("TOKYO-001")),
            Map.entry("시부야스카이", SOURCE_REF_IMAGES.get("TOKYO-002")),
            Map.entry("츠키지장외시장", SOURCE_REF_IMAGES.get("TOKYO-003")),
            Map.entry("신주쿠교엔", SOURCE_REF_IMAGES.get("TOKYO-004")),
            Map.entry("우에노공원", SOURCE_REF_IMAGES.get("TOKYO-005")),
            Map.entry("하라주쿠다케시타도리", SOURCE_REF_IMAGES.get("TOKYO-006")),
            Map.entry("오다이바해변공원", SOURCE_REF_IMAGES.get("TOKYO-007")),
            Map.entry("메이지신궁", SOURCE_REF_IMAGES.get("TOKYO-008")),
            Map.entry("기요미즈데라", SOURCE_REF_IMAGES.get("KYOTO-001")),
            Map.entry("후시미이나리타이샤", SOURCE_REF_IMAGES.get("KYOTO-002")),
            Map.entry("니시키시장", SOURCE_REF_IMAGES.get("KYOTO-003")),
            Map.entry("아라시야마대나무숲", SOURCE_REF_IMAGES.get("KYOTO-004")),
            Map.entry("기온", SOURCE_REF_IMAGES.get("KYOTO-005")),
            Map.entry("금각사", SOURCE_REF_IMAGES.get("KYOTO-006")),
            Map.entry("철학의길", SOURCE_REF_IMAGES.get("KYOTO-007")),
            Map.entry("교토역빌딩", SOURCE_REF_IMAGES.get("KYOTO-008")),
            Map.entry("도톤보리", SOURCE_REF_IMAGES.get("OSAKA-001")),
            Map.entry("오사카성공원", SOURCE_REF_IMAGES.get("OSAKA-002")),
            Map.entry("신사이바시스지", SOURCE_REF_IMAGES.get("OSAKA-003")),
            Map.entry("우메다스카이빌딩", SOURCE_REF_IMAGES.get("OSAKA-004")),
            Map.entry("덴포잔대관람차", SOURCE_REF_IMAGES.get("OSAKA-005")),
            Map.entry("구로몬시장", SOURCE_REF_IMAGES.get("OSAKA-006")),
            Map.entry("오호리공원", SOURCE_REF_IMAGES.get("FUKUOKA-001")),
            Map.entry("나카스포장마차거리", SOURCE_REF_IMAGES.get("FUKUOKA-002")),
            Map.entry("다자이후텐만구", SOURCE_REF_IMAGES.get("FUKUOKA-003")),
            Map.entry("모모치해변", SOURCE_REF_IMAGES.get("FUKUOKA-004")),
            Map.entry("캐널시티하카타", SOURCE_REF_IMAGES.get("FUKUOKA-005")),
            Map.entry("마린월드우미노나카미치", SOURCE_REF_IMAGES.get("FUKUOKA-006")));

    private LocalTripImageCatalog() {
    }

    static String resolve(Destination destination) {
        String byName = NAME_IMAGES.get(normalizeName(destination.getName()));
        if (byName != null) {
            return byName;
        }
        String bySource = SOURCE_REF_IMAGES.get(normalizeSourceRef(destination.getSourceRef()));
        if (bySource != null) {
            return bySource;
        }
        return null;
    }

    static String resolveOrExisting(Destination destination) {
        String verified = resolve(destination);
        if (verified != null) {
            return verified;
        }
        if (isFoodOrCafe(destination)) {
            return COMMON_FOOD_CAFE_IMAGE;
        }
        if ("batch".equals(destination.getSource())) {
            return null;
        }
        return destination.getImageUrl();
    }

    private static boolean isFoodOrCafe(Destination destination) {
        String text = ((destination.getPrimaryStyle() == null ? "" : destination.getPrimaryStyle()) + " "
                + (destination.getCategory() == null ? "" : destination.getCategory()) + " "
                + (destination.getStyleTags() == null ? "" : destination.getStyleTags()));
        return text.matches(".*(식당|음식|맛집|카페|커피|디저트|브런치).*");
    }

    private static String normalizeSourceRef(String value) {
        if (value == null) {
            return "";
        }
        String normalized = value.trim();
        int lastDash = normalized.lastIndexOf('-');
        if (lastDash > 0 && normalized.startsWith("ADMIN1-")) {
            String region = normalized.substring("ADMIN1-".length(), lastDash);
            String number = normalized.substring(lastDash + 1);
            return region + "-" + number;
        }
        return normalized;
    }

    private static String normalizeName(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "");
    }

    private static String image(String fileName) {
        return "https://commons.wikimedia.org/wiki/Special:Redirect/file/"
                + URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20")
                + "?width=1200";
    }
}
