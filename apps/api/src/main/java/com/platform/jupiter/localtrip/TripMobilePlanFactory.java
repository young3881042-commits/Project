package com.platform.jupiter.localtrip;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

final class TripMobilePlanFactory {
    private static final Pattern TIME_RANGE = Pattern.compile("(\\d{1,2}:\\d{2})\\s*[-~]\\s*(\\d{1,2}:\\d{2})");
    private static final List<Map<String, Object>> TICKET_LINKS = list(
            map(
                    "name", "간쿠치카토쿠 Ticket",
                    "type", "공항+Osaka Metro 환승권",
                    "price", "¥1,020",
                    "url", "https://www.nankai.co.jp/en_railway/ticket/",
                    "note", "간사이공항에서 오사카 메트로 역까지 이동할 때 공식 판매 여부를 확인하세요."),
            map(
                    "name", "Osaka Metro Enjoy Eco Card",
                    "type", "오사카 메트로/시티버스 1일권",
                    "price", "평일 ¥820 / 토·일·공휴일 ¥620",
                    "url", "https://subway.osakametro.co.jp/en/guide/page/enjoy-eco.php",
                    "note", "06.27은 토요일이라 성인 ¥620 기준입니다."),
            map(
                    "name", "ICOCA",
                    "type", "교통 IC 카드",
                    "price", "충전식",
                    "url", "https://www.jr-odekake.net/icoca/",
                    "note", "교토, USJ, 사철/버스 혼합 이동일에 추천합니다."),
            map(
                    "name", "Kyoto-Osaka Sightseeing Pass",
                    "type", "비교용 패스",
                    "price", "공식 페이지 확인",
                    "url", "https://www.keihan.co.jp/travel/en/trains/passes-for-visitors-to-japan/",
                    "note", "이번 동선은 한큐, 란덴, 교토 시내버스가 섞여 커버가 애매해 비추천입니다."),
            map(
                    "name", "Hankyu Tourist Pass",
                    "type", "비교용 패스",
                    "price", "공식 페이지 확인",
                    "url", "https://www.hankyu.co.jp/en/",
                    "note", "아라시야마·가와라마치 일부 이동에는 맞지만 교토 시내 이동 전체를 커버하지 못합니다."),
            map(
                    "name", "JR Kansai Area Pass",
                    "type", "비교용 JR 패스",
                    "price", "1일권 ¥2,800부터",
                    "url", "https://www.westjr.co.jp/global/en/ticket/pass/kansai/",
                    "note", "이번 동선은 난카이, 한큐, 란덴, 메트로 비중이 커 비추천입니다."),
            map(
                    "name", "USJ Studio Pass",
                    "type", "테마파크 입장권",
                    "price", "날짜별 변동",
                    "url", "https://www.usj.co.jp/web/en/us/tickets/studio-pass",
                    "note", "방문 전 공식 운영시간, 입장권, 익스프레스 패스 재고를 확인하세요."));

    private TripMobilePlanFactory() {
    }

    static Map<String, Object> from(TravelPlan plan, List<TravelPlanItem> items) {
        if (isOsakaKyotoUsjPlan(plan)) {
            return osakaKyotoUsjPlan();
        }
        return legacyMobilePlan(plan, items);
    }

    private static boolean isOsakaKyotoUsjPlan(TravelPlan plan) {
        String text = String.join(" ",
                text(plan.getTitle()),
                text(plan.getRegion()),
                text(plan.getSummary()),
                text(plan.getStyles())).toLowerCase();
        return (text.contains("오사카") || text.contains("osaka"))
                && (text.contains("교토") || text.contains("kyoto"))
                && (text.contains("usj") || text.contains("유니버설"));
    }

    private static Map<String, Object> osakaKyotoUsjPlan() {
        return map(
                "trip", map(
                        "title", "오사카·교토·USJ 3박 4일",
                        "startDate", "2026-06-27",
                        "endDate", "2026-06-30",
                        "hotel", "아크호텔 오사카 신사이바시",
                        "people", "2명",
                        "summary", "간사이공항 입국, 오사카 야경, 교토 핵심 동선, USJ 하루, 간사이공항 출국까지 모바일 카드로 확인하는 일정입니다. 후시미이나리는 밤 이동 부담으로 제외했습니다."),
                "daySummaries", list(
                        daySummary(1, "2026-06-27", "공항 도착과 오사카 야경", "간사이공항 -> 호텔 짐 맡기기 -> 오사카성 -> 하루카스300 -> 신세카이/츠텐카쿠 -> 도톤보리/호젠지요코초", "입국일, 오사카 대표 야경", "1인 약 ¥9,000~¥13,000 + 쇼핑", "간쿠치카토쿠 ¥1,020 + Osaka Metro Enjoy Eco Card 토요일 ¥620"),
                        daySummary(2, "2026-06-28", "교토 풀코스", "호텔 -> 아라시야마 -> 금각사 -> 청수사 -> 산넨자카/니넨자카 -> 야사카신사 -> 하나미코지/기온 -> 오사카", "후시미이나리 제외, 서쪽에서 동쪽으로 이동", "1인 약 ¥11,000~¥16,000 + 쇼핑", "교토는 IC카드 추천"),
                        daySummary(3, "2026-06-29", "USJ 하루종일", "호텔 -> 유니버설시티 -> USJ -> 신사이바시/도톤보리", "입장권 별도, 밤 쇼핑", "1인 약 ¥20,000~¥32,000 + 쇼핑", "USJ는 IC카드 추천"),
                        daySummary(4, "2026-06-30", "공항 출국", "호텔 체크아웃 -> 간단식 -> 덴가차야 환승 -> 간사이공항", "변수를 줄이는 공항 직행", "1인 약 ¥3,000~¥5,000", "간쿠치카토쿠 Ticket ¥1,020")),
                "days", list(
                        day(1, "2026-06-27", "공항 도착과 오사카 야경", list(
                                item("d1-arrival", "휴식", "10:30", "11:15", "45분", "간사이공항 도착·입국 정리", "수하물 수령, 교통권 구매, ICOCA 충전까지 정리합니다.", "간사이국제공항 제1터미널", null, null, emptyCost(), list("Nankai 매표소 위치를 먼저 확인")),
                                item("d1-kix-hotel", "이동", "11:15", "12:25", "70분", "간사이공항역에서 호텔까지 이동", "공항에서 덴가차야 환승으로 나가호리바시까지 이동합니다.", "간사이공항역 -> 아크호텔 오사카 신사이바시", transport("간사이공항역", "아크호텔 오사카 신사이바시", 70, list(
                                        step("Nankai 공항선 Airport Express", "난바 방면", "간사이공항역", "덴가차야역", "Osaka Metro 사카이스지선 환승", ""),
                                        step("Osaka Metro 사카이스지선", "텐진바시스지6초메 방면", "덴가차야역", "나가호리바시역", "", "2-A 출구 기준 호텔까지 도보 약 5~7분"))), null, kankuChikatokuCost(), list("라피트 특급권은 별도")),
                                item("d1-luggage", "휴식", "12:25", "12:45", "20분", "숙소 프런트 짐 맡기기", "체크인 전 캐리어를 맡기고 가벼운 차림으로 이동합니다.", "아크호텔 오사카 신사이바시", null, null, emptyCost(), list("여권, 지갑, 보조배터리만 작은 가방에 분리")),
                                item("d1-lunch", "식사", "12:55", "13:45", "50분", "이치란 도톤보리점 점심", "첫 식사는 주문이 쉬운 라멘으로 빠르게 해결합니다.", "도톤보리", null, meal("점심", "이치란 도톤보리점", "돈코츠 라멘, 반숙달걀", "¥1,300~¥1,800", "한국인 여행객에게 익숙하고 회전이 빠른 편입니다."), cost("", "", list(), "", "", "", "¥1,300~¥1,800", "", "식비 별도"), list("웨이팅이 길면 킨류라멘 또는 도톤보리 이마이로 변경")),
                                item("d1-osakacastle-move", "이동", "13:45", "14:20", "35분", "호텔 권역에서 오사카성으로 이동", "나가호리바시에서 모리노미야까지 메트로로 이동합니다.", "나가호리바시역 -> 오사카성 공원", transport("나가호리바시역", "오사카성 공원", 35, list(step("Osaka Metro 나가호리쓰루미료쿠치선", "카도마미나미 방면", "나가호리바시역", "모리노미야역", "", "3-B 출구 기준 오사카성 공원까지 도보 약 10분"))), null, osakaMetroCost(), list()),
                                item("d1-osakacastle", "관광", "14:20", "15:40", "80분", "오사카성 공원", "입국일 오후라 공원과 성곽 산책 중심으로 봅니다.", "오사카성 공원", null, null, cost("", "", list(), "", "", "천수각 입장 시 약 ¥600", "", "", "공원 산책은 무료"), list()),
                                item("d1-harukas-move", "이동", "15:40", "16:15", "35분", "오사카성에서 하루카스300으로 이동", "모리노미야에서 덴노지까지 메트로 환승으로 이동합니다.", "오사카성 공원 -> 아베노 하루카스", transport("모리노미야역", "덴노지역", 35, list(
                                        step("Osaka Metro 나가호리쓰루미료쿠치선", "타이쇼 방면", "모리노미야역", "타니마치6초메역", "타니마치선 환승", ""),
                                        step("Osaka Metro 타니마치선", "야오미나미 방면", "타니마치6초메역", "덴노지역", "", "아베노 하루카스까지 도보 약 5분"))), null, osakaMetroCost(), list()),
                                item("d1-harukas", "관광", "16:20", "17:40", "80분", "하루카스300 전망대", "해 질 무렵 오사카 도심과 베이 방향 전망을 봅니다.", "아베노 하루카스", null, null, cost("", "", list(), "", "", "약 ¥2,000", "", "", "일몰 시간대 사전 예매 권장"), list()),
                                item("d1-shinsekai-move", "이동", "17:40", "18:00", "20분", "하루카스에서 신세카이로 이동", "덴노지에서 도부쓰엔마에까지 한 정거장 이동 후 걸어갑니다.", "덴노지역 -> 신세카이", transport("덴노지역", "신세카이·츠텐카쿠", 20, list(step("Osaka Metro 미도스지선", "나카모즈 방면", "덴노지역", "도부쓰엔마에역", "", "1번 출구 기준 츠텐카쿠까지 도보 약 7분"))), null, osakaMetroCost(), list()),
                                item("d1-dinner", "식사", "19:00", "20:00", "60분", "쿠시카츠 다루마 신세카이 저녁", "오사카 대표 쿠시카츠로 입국일 저녁을 마무리합니다.", "신세카이", null, meal("저녁", "쿠시카츠 다루마 신세카이 총본점", "쿠시카츠 세트, 도테야키", "¥2,500~¥3,500", "한국인 여행객에게 유명한 오사카 대표 체인입니다."), cost("", "", list(), "", "", "", "¥2,500~¥3,500", "", ""), list()),
                                item("d1-dotonbori-move", "이동", "20:00", "20:20", "20분", "신세카이에서 도톤보리로 이동", "도부쓰엔마에에서 닛폰바시로 이동해 도톤보리 동쪽으로 들어갑니다.", "도부쓰엔마에역 -> 도톤보리", transport("도부쓰엔마에역", "도톤보리·호젠지요코초", 20, list(step("Osaka Metro 사카이스지선", "텐진바시스지6초메 방면", "도부쓰엔마에역", "닛폰바시역", "", "도톤보리 강변까지 도보 약 8분"))), null, osakaMetroCost(), list()),
                                item("d1-dotonbori", "관광", "20:20", "21:30", "70분", "도톤보리·호젠지요코초 야경", "글리코 사인, 도톤보리 강변, 호젠지요코초를 짧은 도보로 묶습니다.", "도톤보리", null, null, cost("", "", list(), "", "", "", "", "", "무료 산책"), list("글리코 사인은 에비스바시에서 촬영")))),
                        day(2, "2026-06-28", "교토 풀코스", list(
                                item("d2-breakfast", "식사", "06:55", "07:25", "30분", "코메다커피 신사이바시 아침", "교토 이동 전 호텔 근처에서 가볍게 시작합니다.", "신사이바시", null, meal("아침", "코메다커피 신사이바시점", "모닝 토스트 세트, 커피", "¥700~¥1,100", "안정적인 아침 후보입니다."), cost("", "", list(), "", "", "", "¥700~¥1,100", "", ""), list()),
                                item("d2-arashiyama-move", "이동", "07:35", "09:05", "90분", "호텔에서 아라시야마로 이동", "사카이스지선-한큐-아라시야마선을 이어 타는 교토 진입 루트입니다.", "나가호리바시역 -> 한큐 아라시야마역", transport("나가호리바시역", "한큐 아라시야마역", 90, list(
                                        step("Osaka Metro 사카이스지선", "텐진바시스지6초메·한큐 직통 방면", "나가호리바시역", "아와지역", "한큐 교토선 환승", ""),
                                        step("한큐 교토선", "교토카와라마치 방면", "아와지역", "가쓰라역", "한큐 아라시야마선 환승", ""),
                                        step("한큐 아라시야마선", "아라시야마 방면", "가쓰라역", "아라시야마역", "", "도게츠교까지 도보 약 8분"))), null, icCost("약 ¥700~¥900", "Osaka Metro/한큐 혼합이라 ICOCA 추천"), list()),
                                item("d2-arashiyama", "관광", "09:05", "10:20", "75분", "아라시야마 대나무숲·도게츠교", "대나무숲을 먼저 걷고 강변 도게츠교까지 이어 봅니다.", "아라시야마", null, null, cost("", "", list(), "", "", "", "", "", "대나무숲/도게츠교 산책 무료"), list()),
                                item("d2-kinkakuji-move", "이동", "10:20", "11:15", "55분", "아라시야마에서 금각사로 이동", "란덴으로 기타노하쿠바이초까지 간 뒤 금각사 앞 버스로 연결합니다.", "아라시야마 -> 금각사", transport("란덴 아라시야마역", "금각사", 55, list(
                                        step("란덴 아라시야마본선", "시조오미야 방면", "아라시야마역", "가타비라노쓰지역", "란덴 기타노선 환승", ""),
                                        step("란덴 기타노선", "기타노하쿠바이초 방면", "가타비라노쓰지역", "기타노하쿠바이초역", "교토 시버스 환승", ""),
                                        step("교토 시버스 204 또는 205번", "금각사 방면", "기타노하쿠바이초 정류장", "금각사미치 정류장", "", "금각사 입구까지 도보 약 5분"))), null, icCost("약 ¥500~¥700", "란덴+교토 시버스는 IC카드 추천"), list()),
                                item("d2-kinkakuji", "관광", "11:15", "12:05", "50분", "금각사", "정원 동선이 정해져 있어 50분 안팎으로 보기 좋습니다.", "교토 기타구", null, null, cost("", "", list(), "", "", "약 ¥500", "", "", "현장 결제"), list()),
                                item("d2-lunch", "식사", "13:00", "14:00", "60분", "가츠쿠라 산조 본점 점심", "교토에서 한국인 여행객에게 유명한 돈카츠 식당입니다.", "산조·가와라마치", null, meal("점심", "가츠쿠라 산조 본점", "로스카츠 정식, 히레카츠 정식", "¥1,800~¥2,800", "웨이팅이 길면 니시키시장 식사로 변경합니다."), cost("", "", list(), "", "", "", "¥1,800~¥2,800", "", ""), list()),
                                item("d2-kiyomizu-move", "이동", "14:00", "14:30", "30분", "가와라마치에서 청수사로 이동", "시조카와라마치에서 기요미즈미치로 버스 이동 후 언덕길을 걷습니다.", "시조카와라마치 -> 청수사", transport("시조카와라마치 정류장", "청수사", 30, list(step("교토 시버스 207번", "기요미즈데라·도후쿠지 방면", "시조카와라마치 정류장", "기요미즈미치 정류장", "", "청수사 입구까지 오르막 도보 약 12~15분"))), null, icCost("약 ¥230~¥300", "교토 시내버스 IC 결제"), list()),
                                item("d2-kiyomizu-sannenzaka", "관광", "14:30", "16:35", "125분", "청수사·산넨자카·니넨자카", "청수사 관람 후 전통 골목, 기념품, 사진 포인트를 이어 봅니다.", "히가시야마", null, null, cost("", "", list(), "", "", "청수사 약 ¥500", "", "선택", "골목 쇼핑 별도"), list("계단이 많아 천천히 이동")),
                                item("d2-yasaka", "관광", "17:25", "18:00", "35분", "야사카신사", "기온으로 넘어가기 전 무료로 짧게 들르기 좋은 신사입니다.", "기온", null, null, cost("", "", list(), "", "", "", "", "", "무료 관람"), list()),
                                item("d2-dinner", "식사", "18:05", "19:05", "60분", "기온 덕 누들 저녁", "기온권에서 동선을 크게 벗어나지 않는 인기 라멘 후보입니다.", "기온", null, meal("저녁", "Gion Duck Noodles", "오리 라멘, 츠케멘", "¥1,500~¥2,500", "웨이팅이 길면 폰토초/가와라마치 식당가로 변경합니다."), cost("", "", list(), "", "", "", "¥1,500~¥2,500", "", ""), list()),
                                item("d2-gion-night", "관광", "19:10", "20:20", "70분", "하나미코지 & 기온거리 야경", "후시미이나리는 제외하고 밝고 사람 많은 기온 중심부 야경만 봅니다.", "기온·하나미코지", null, null, cost("", "", list(), "", "", "", "", "", "무료 산책"), list("늦은 골목 이동은 피하고 큰길 중심으로 이동")),
                                item("d2-return", "이동", "20:20", "21:35", "75분", "교토 가와라마치에서 오사카 복귀", "한큐 교토선으로 우메다까지 이동 후 미도스지선으로 신사이바시에 복귀합니다.", "교토가와라마치역 -> 아크호텔 오사카 신사이바시", transport("교토가와라마치역", "아크호텔 오사카 신사이바시", 75, list(
                                        step("한큐 교토선 특급", "오사카우메다 방면", "교토가와라마치역", "오사카우메다역", "Osaka Metro 미도스지선 환승", ""),
                                        step("Osaka Metro 미도스지선", "나카모즈 방면", "우메다역", "신사이바시역", "", "호텔까지 도보 약 10분"))), null, icCost("약 ¥650~¥850", "한큐+Osaka Metro 혼합이라 ICOCA 추천"), list()))),
                        day(3, "2026-06-29", "USJ 하루종일", list(
                                item("d3-breakfast", "식사", "07:20", "07:50", "30분", "마츠야 나가호리바시 아침", "USJ 입장 전 빠르게 먹는 아침입니다.", "나가호리바시", null, meal("아침", "마츠야 나가호리바시점", "규메시, 조식 정식", "¥500~¥900", "이른 시간 운영 매장이 많아 개장 대기 일정에 맞추기 쉽습니다."), cost("", "", list(), "", "", "", "¥500~¥900", "", ""), list()),
                                item("d3-usj-move", "이동", "07:55", "08:45", "50분", "호텔에서 유니버설시티로 이동", "오사카 도심에서 니시쿠조를 거쳐 유니버설시티역으로 갑니다.", "나가호리바시역 -> 유니버설시티역", transport("나가호리바시역", "유니버설시티역", 50, list(
                                        step("Osaka Metro 나가호리쓰루미료쿠치선", "타이쇼 방면", "나가호리바시역", "돔마에치요자키역", "한신 난바선 환승", "한신 도무마에역까지 도보 환승"),
                                        step("한신 난바선", "아마가사키 방면", "도무마에역", "니시쿠조역", "JR 유메사키선 환승", ""),
                                        step("JR 유메사키선", "사쿠라지마 방면", "니시쿠조역", "유니버설시티역", "", "USJ 입구까지 도보 약 5분"))), null, icCost("약 ¥500~¥700", "USJ 이동은 IC카드 추천"), list()),
                                item("d3-usj", "관광", "09:00", "20:00", "하루종일", "유니버설 스튜디오 재팬", "공식 앱에서 에어리어 입장 정리권과 대기시간을 확인하며 하루를 보냅니다.", "USJ", null, null, cost("", "", list(), "", "", "Studio Pass 날짜별 변동", "", "선택", "입장권/익스프레스 패스는 공식 구매 권장"), list("슈퍼 닌텐도 월드 정리권 확인")),
                                item("d3-lunch", "식사", "12:30", "13:30", "60분", "키노피오 카페 점심", "슈퍼 닌텐도 월드 입장이 잡혔을 때 만족도가 높은 점심 후보입니다.", "USJ 슈퍼 닌텐도 월드", null, meal("점심", "키노피오 카페", "마리오 버거, 오므라이스 메뉴", "¥2,500~¥4,000", "정리권 상황에 따라 파크 내 다른 식당으로 바꿉니다."), cost("", "", list(), "", "", "", "¥2,500~¥4,000", "", ""), list()),
                                item("d3-dinner", "식사", "20:10", "20:55", "45분", "타코파 유니버설 시티워크 저녁", "퇴장 후 역 앞 시티워크에서 타코야키를 비교해 먹습니다.", "유니버설 시티워크 오사카", null, meal("저녁", "TAKOPA 유니버설 시티워크 오사카", "타코야키 비교 세트", "¥1,200~¥2,500", "USJ 퇴장 후 이동 전 먹기 편한 인기 코스입니다."), cost("", "", list(), "", "", "", "¥1,200~¥2,500", "", ""), list()),
                                item("d3-return", "이동", "20:55", "21:45", "50분", "유니버설시티에서 신사이바시로 복귀", "JR 유메사키선과 한신 난바선을 이용해 도톤보리 권역으로 돌아옵니다.", "유니버설시티역 -> 신사이바시", transport("유니버설시티역", "신사이바시·도톤보리", 50, list(
                                        step("JR 유메사키선", "니시쿠조 방면", "유니버설시티역", "니시쿠조역", "한신 난바선 환승", ""),
                                        step("한신 난바선", "오사카난바 방면", "니시쿠조역", "오사카난바역", "", "도톤보리까지 도보 약 10분"))), null, icCost("약 ¥400~¥600", "JR+한신 혼합이라 ICOCA 추천"), list()),
                                item("d3-shopping", "쇼핑", "21:45", "22:30", "45분", "신사이바시·도톤보리 쇼핑 야경", "돈키호테, 드럭스토어, 도톤보리 야경을 짧게 정리합니다.", "신사이바시·도톤보리", null, null, cost("", "", list(), "", "", "", "", "선택", "쇼핑 예산 별도"), list("다음 날 출국이라 액체류와 면세 봉투 정리")))),
                        day(4, "2026-06-30", "공항 출국", list(
                                item("d4-checkout", "휴식", "07:00", "07:25", "25분", "체크아웃·짐 정리", "여권, 항공권, 면세품, 보조배터리 위치를 확인합니다.", "아크호텔 오사카 신사이바시", null, null, emptyCost(), list("보조배터리는 위탁 수하물 금지")),
                                item("d4-breakfast", "식사", "07:25", "07:50", "25분", "조식 또는 공항 간단식", "항공편 시간에 따라 호텔 근처 조식 또는 공항 도착 후 간단식으로 조정합니다.", "호텔 근처 또는 간사이공항", null, meal("아침", "호텔 조식 또는 간사이공항 푸드코트", "주먹밥, 샌드위치, 커피", "¥800~¥1,500", "공항 도착 시간을 우선하고 식사는 짧게 처리합니다."), cost("", "", list(), "", "", "", "¥800~¥1,500", "", ""), list()),
                                item("d4-kix-move", "이동", "08:00", "09:25", "85분", "호텔에서 간사이공항으로 이동", "나가호리바시에서 덴가차야로 이동 후 Nankai 공항선으로 공항까지 갑니다.", "아크호텔 오사카 신사이바시 -> 간사이공항", transport("나가호리바시역", "간사이공항역", 85, list(
                                        step("Osaka Metro 사카이스지선", "덴가차야 방면", "나가호리바시역", "덴가차야역", "Nankai 공항선 환승", ""),
                                        step("Nankai 공항선 Airport Express", "간사이공항 방면", "덴가차야역", "간사이공항역", "", "터미널까지 안내 표지 따라 이동"))), null, kankuChikatokuCost(), list("항공편 출발 2~3시간 전 공항 도착 기준으로 역산")),
                                item("d4-airport", "휴식", "09:25", "11:00", "95분", "간사이공항 체크인·출국", "체크인, 수하물 위탁, 보안검색, 출국심사를 여유 있게 처리합니다.", "간사이국제공항", null, null, cost("", "", list(), "", "", "", "", "", "공항 내 추가 식음료/쇼핑 별도"), list("항공사 카운터와 터미널을 전날 재확인"))))),
                "budget", map(
                        "currency", "JPY",
                        "perPersonEstimate", "약 ¥43,000~¥66,000 + 쇼핑",
                        "transport", "패스 ¥2,660 + IC 약 ¥3,500~¥5,000",
                        "tickets", "하루카스300, 츠텐카쿠, 교토 사찰, USJ Studio Pass 별도",
                        "food", "약 ¥18,000~¥28,000",
                        "shopping", "개인 선택",
                        "memo", "USJ 입장권과 익스프레스 패스 여부에 따라 전체 예산 변동이 큽니다."),
                "passRecommendation", map(
                        "summary", "오사카 도심일은 패스, 교토/USJ는 IC카드가 가장 단순합니다.",
                        "byDate", list(
                                passByDate("2026-06-27", "간쿠치카토쿠 Ticket ¥1,020 + Osaka Metro Enjoy Eco Card 토요일 ¥620", "공항-호텔 이동과 오사카 도심 메트로 이동 비용 표시가 명확합니다."),
                                passByDate("2026-06-28", "ICOCA", "한큐, 란덴, 교토 시버스, Osaka Metro가 섞여 단일 패스 커버가 애매합니다."),
                                passByDate("2026-06-29", "ICOCA", "USJ 이동은 JR/한신/메트로 조합이라 IC카드가 가장 단순합니다."),
                                passByDate("2026-06-30", "간쿠치카토쿠 Ticket ¥1,020", "호텔 권역에서 덴가차야 환승으로 공항까지 가는 출국 루트에 적합합니다.")),
                        "notRecommended", list(
                                map("name", "오사카·교토패스", "reason", "이번 동선은 한큐, 란덴, 교토 시내 이동, 게이한 등이 섞여 커버가 애매합니다."),
                                map("name", "JR Kansai Area Pass", "reason", "JR 중심 장거리 이동이 아니라 난카이/한큐/메트로 비중이 커 효율이 낮습니다."))),
                "ticketLinks", TICKET_LINKS);
    }

    private static Map<String, Object> legacyMobilePlan(TravelPlan plan, List<TravelPlanItem> items) {
        Map<Integer, List<TravelPlanItem>> grouped = items.stream()
                .filter(item -> item.getDayNumber() != null)
                .sorted(Comparator.comparing(TravelPlanItem::getDayNumber).thenComparing(TravelPlanItem::getSequenceNumber))
                .collect(Collectors.groupingBy(TravelPlanItem::getDayNumber, LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> days = new ArrayList<>();
        for (Map.Entry<Integer, List<TravelPlanItem>> entry : grouped.entrySet()) {
            List<Map<String, Object>> mobileItems = new ArrayList<>();
            TravelPlanItem previous = null;
            int index = 1;
            for (TravelPlanItem source : entry.getValue()) {
                mobileItems.add(legacyItem(source, previous, index++));
                previous = source;
            }
            days.add(day(entry.getKey(), "", entry.getKey() + "일차", mobileItems));
        }
        return map(
                "trip", map(
                        "title", text(plan.getTitle(), "여행 계획"),
                        "startDate", "",
                        "endDate", "",
                        "hotel", text(plan.getStartPlace()),
                        "people", plan.getTravelerCount() == null ? "인원 미정" : plan.getTravelerCount() + "명",
                        "summary", text(plan.getSummary(), "기존 여행 계획을 모바일 카드형 일정으로 변환했습니다.")),
                "daySummaries", days.stream()
                        .map(day -> daySummary(
                                (Integer) day.get("day"),
                                text(day.get("date")),
                                text(day.get("title")),
                                ((List<?>) day.get("items")).stream()
                                        .map(item -> text(((Map<?, ?>) item).get("title")))
                                        .limit(5)
                                        .collect(Collectors.joining(" -> ")),
                                "기존 일정 변환",
                                text(plan.getEstimatedBudget(), "확인 필요"),
                                "패스/IC 구분 확인 필요"))
                        .toList(),
                "days", days,
                "budget", map(
                        "currency", "JPY/KRW",
                        "perPersonEstimate", text(plan.getEstimatedBudget(), "확인 필요"),
                        "transport", "기존 일정 변환 후 확인 필요",
                        "tickets", "기존 일정 변환 후 확인 필요",
                        "food", "기존 일정 변환 후 확인 필요",
                        "shopping", "개인 선택",
                        "memo", "상세 비용 구조는 새 생성 API가 내려주는 값으로 보강됩니다."),
                "passRecommendation", map(
                        "summary", "기존 일정 변환: 지역별 교통권은 별도 확인 필요",
                        "byDate", list(),
                        "notRecommended", list()),
                "ticketLinks", TICKET_LINKS);
    }

    private static Map<String, Object> legacyItem(TravelPlanItem source, TravelPlanItem previous, int index) {
        TimeRange range = parseTimeRange(source.getTimeSlot());
        String category = categoryFrom(source);
        String title = text(source.getDestinationName(), "코스 " + index);
        String location = text(source.getRegion(), title);
        return item(
                "legacy-" + text(source.getId(), String.valueOf(index)),
                category,
                range.startTime(),
                range.endTime(),
                source.getDurationMinutes() == null ? "" : source.getDurationMinutes() + "분",
                title,
                text(source.getNote(), "세부 설명을 확인하세요."),
                location,
                "이동".equals(category) ? transport(
                        previous == null ? "이전 장소" : text(previous.getDestinationName(), "이전 장소"),
                        title,
                        source.getDurationMinutes() == null ? 0 : source.getDurationMinutes(),
                        list(step("대중교통 상세 확인", "현장 경로 검색 기준", previous == null ? "이전 장소" : text(previous.getDestinationName(), "이전 장소"), title, "", "정확한 승강장과 출구는 당일 지도 앱으로 확인"))) : null,
                "식사".equals(category) ? meal(mealType(title, source.getPrimaryStyle()), title, "대표 메뉴 확인", "", text(source.getNote(), "현장 영업시간과 대기시간 확인")) : null,
                cost("", "", list(), "", "", "", "", "", "기존 일정에서 변환됨. 실제 요금은 IC카드/패스 기준으로 확인 필요"),
                list());
    }

    private static String categoryFrom(TravelPlanItem source) {
        String text = String.join(" ", text(source.getPrimaryStyle()), text(source.getDestinationName()), text(source.getNote()));
        if (text.matches(".*(이동|공항|복귀|환승).*")) return "이동";
        if (text.matches(".*(식당|식사|아침|점심|저녁|카페|디저트|간식|라멘|커피|브런치|맛집).*")) return "식사";
        if (text.matches(".*(쇼핑|시장|기념품|드럭스토어|상점).*")) return "쇼핑";
        if (text.matches(".*(휴식|호텔|숙소|체크인|체크아웃|짐|여유).*")) return "휴식";
        return "관광";
    }

    private static String mealType(String title, String style) {
        String text = title + " " + text(style);
        if (text.contains("아침")) return "아침";
        if (text.contains("점심")) return "점심";
        if (text.contains("저녁")) return "저녁";
        if (text.contains("카페") || text.contains("커피") || text.contains("디저트")) return "카페";
        return "식사";
    }

    private static TimeRange parseTimeRange(String value) {
        Matcher matcher = TIME_RANGE.matcher(text(value));
        if (!matcher.find()) {
            return new TimeRange("", "");
        }
        return new TimeRange(matcher.group(1), matcher.group(2));
    }

    private static Map<String, Object> daySummary(int day, String date, String title, String route, String theme, String estimatedCost, String passSummary) {
        return map("day", day, "date", date, "title", title, "route", route, "theme", theme, "estimatedCost", estimatedCost, "passSummary", passSummary);
    }

    private static Map<String, Object> day(int day, String date, String title, List<Map<String, Object>> items) {
        return map("day", day, "date", date, "title", title, "items", items);
    }

    private static Map<String, Object> item(
            String id,
            String category,
            String startTime,
            String endTime,
            String durationText,
            String title,
            String description,
            String location,
            Map<String, Object> transport,
            Map<String, Object> meal,
            Map<String, Object> cost,
            List<String> tips) {
        return map(
                "id", id,
                "category", category,
                "startTime", startTime,
                "endTime", endTime,
                "durationText", durationText,
                "title", title,
                "description", description,
                "location", location,
                "transport", transport,
                "meal", meal,
                "cost", cost,
                "tips", tips);
    }

    private static Map<String, Object> transport(String from, String to, int durationMinutes, List<Map<String, Object>> route) {
        return map("from", from, "to", to, "durationMinutes", durationMinutes, "route", route);
    }

    private static Map<String, Object> step(String line, String direction, String board, String alight, String transfer, String walkText) {
        return map("line", line, "direction", direction, "board", board, "alight", alight, "transfer", transfer, "walkText", walkText);
    }

    private static Map<String, Object> meal(String type, String restaurant, String recommendedMenu, String expectedCost, String note) {
        return map("type", type, "restaurant", restaurant, "recommendedMenu", recommendedMenu, "expectedCost", expectedCost, "note", note);
    }

    private static Map<String, Object> emptyCost() {
        return cost("", "", list(), "", "", "", "", "", "");
    }

    private static Map<String, Object> osakaMetroCost() {
        return cost("Osaka Metro 1일권", "¥620", list("Osaka Metro"), "¥0", "¥0 추가", "", "", "", "패스 포함 구간");
    }

    private static Map<String, Object> kankuChikatokuCost() {
        return cost("간쿠치카토쿠 Ticket", "¥1,020", list("Nankai 공항선", "Osaka Metro"), "¥0", "¥0 추가", "", "", "", "간사이공항-오사카 메트로 역 이동을 한 장으로 처리");
    }

    private static Map<String, Object> icCost(String amount, String memo) {
        return cost("ICOCA", "충전식", list(), amount, amount, "", "", "", memo);
    }

    private static Map<String, Object> cost(
            String passName,
            String passCost,
            List<String> includedByPass,
            String icOrCashExtra,
            String transportTotal,
            String ticket,
            String food,
            String shopping,
            String memo) {
        return map(
                "passName", passName,
                "passCost", passCost,
                "includedByPass", includedByPass,
                "icOrCashExtra", icOrCashExtra,
                "transportTotal", transportTotal,
                "ticket", ticket,
                "food", food,
                "shopping", shopping,
                "memo", memo);
    }

    private static Map<String, Object> passByDate(String date, String recommendation, String reason) {
        return map("date", date, "recommendation", recommendation, "reason", reason);
    }

    @SuppressWarnings("unchecked")
    private static <T> List<T> list(T... values) {
        List<T> list = new ArrayList<>();
        for (T value : values) {
            list.add(value);
        }
        return list;
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) {
            result.put(String.valueOf(values[index]), values[index + 1]);
        }
        return result;
    }

    private static String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private static String text(Object value, String fallback) {
        String text = text(value);
        return text.isBlank() ? fallback : text;
    }

    private record TimeRange(String startTime, String endTime) {
    }
}
