package com.platform.jupiter.localtrip;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalTripDestinationService {
    private static final String MOCK_SOURCE = "mock";

    private final DestinationRepository destinationRepository;
    private final ApiSyncLogRepository syncLogRepository;
    private final LocalTripSchemaService schemaService;

    public LocalTripDestinationService(
            DestinationRepository destinationRepository,
            ApiSyncLogRepository syncLogRepository,
            LocalTripSchemaService schemaService) {
        this.destinationRepository = destinationRepository;
        this.syncLogRepository = syncLogRepository;
        this.schemaService = schemaService;
    }

    @Transactional
    public List<DestinationResponse> listDestinations(String areaCode, String keyword, String region, String style, Integer page, Integer size) {
        schemaService.ensureSchema();
        String normalizedAreaCode = LocalTripText.normalize(areaCode);
        String normalizedKeyword = LocalTripText.normalize(keyword).toLowerCase(Locale.ROOT);
        String normalizedRegion = LocalTripText.normalize(region);
        String normalizedStyle = LocalTripText.normalize(style);
        int pageNumber = Math.max(0, page == null ? 0 : page);
        int pageSize = Math.min(500, Math.max(1, size == null ? 500 : size));
        return destinationRepository.findAllByOrderByRegionAscPopularityScoreDescNameAsc().stream()
                .filter(destination -> matchesRegion(destination, normalizedRegion, normalizedAreaCode))
                .filter(destination -> normalizedStyle.isBlank() || hasStyle(destination, normalizedStyle))
                .filter(destination -> normalizedKeyword.isBlank() || hasKeyword(destination, normalizedKeyword))
                .skip((long) pageNumber * pageSize)
                .limit(pageSize)
                .map(DestinationResponse::from)
                .toList();
    }

    @Transactional
    public DestinationResponse getDestination(Long id) {
        schemaService.ensureSchema();
        return destinationRepository.findById(id)
                .map(DestinationResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Destination not found"));
    }

    @Transactional
    public ApiSyncLogResponse syncMockDestinations() {
        schemaService.ensureSchema();
        Instant startedAt = Instant.now();
        int inserted = 0;
        int updated = 0;
        List<MockDestination> seeds = mockDestinations();

        for (MockDestination seed : seeds) {
            Destination destination = destinationRepository
                    .findBySourceAndSourceRef(MOCK_SOURCE, seed.sourceRef())
                    .orElseGet(Destination::new);
            boolean isNew = destination.getId() == null;
            applySeed(destination, seed);
            destinationRepository.save(destination);
            if (isNew) {
                inserted++;
            } else {
                updated++;
            }
        }

        ApiSyncLog log = new ApiSyncLog();
        log.setProvider(MOCK_SOURCE);
        log.setSyncType("DESTINATION");
        log.setStatus("SUCCEEDED");
        log.setRecordsInserted(inserted);
        log.setRecordsUpdated(updated);
        log.setRequestUrl("localtrip://mock/destinations");
        log.setMessage("Mock destination sync completed with " + seeds.size() + " records.");
        log.setStartedAt(startedAt);
        log.setEndedAt(Instant.now());
        return ApiSyncLogResponse.from(syncLogRepository.save(log));
    }

    @Transactional
    public List<Destination> findCandidates(List<String> regions, List<String> styles) {
        schemaService.ensureSchema();
        List<String> normalizedRegions = regions.stream()
                .map(LocalTripText::normalize)
                .filter(value -> !value.isBlank())
                .toList();
        List<String> normalizedStyles = styles.stream()
                .map(LocalTripText::normalize)
                .filter(value -> !value.isBlank())
                .toList();

        List<Destination> all = destinationRepository.findAllByOrderByRegionAscPopularityScoreDescNameAsc();
        List<Destination> strict = filter(all, normalizedRegions, normalizedStyles);
        if (!strict.isEmpty()) {
            return strict;
        }

        List<Destination> regionOnly = filter(all, normalizedRegions, List.of());
        if (!regionOnly.isEmpty()) {
            return regionOnly;
        }

        return all.stream()
                .sorted(Comparator.comparing(Destination::getPopularityScore).reversed().thenComparing(Destination::getName))
                .toList();
    }

    @Transactional
    public List<Destination> findCandidatesForPlan(List<Long> destinationIds, List<String> regions, List<String> styles) {
        schemaService.ensureSchema();
        List<Destination> baseCandidates = findCandidates(regions, styles);
        if (destinationIds == null || destinationIds.isEmpty()) {
            return baseCandidates;
        }

        Map<Long, Destination> merged = new LinkedHashMap<>();
        destinationRepository.findAllById(destinationIds).stream()
                .sorted(Comparator.comparing(destination -> destinationIds.indexOf(destination.getId())))
                .forEach(destination -> merged.put(destination.getId(), destination));
        baseCandidates.forEach(destination -> {
            if (destination.getId() != null) {
                merged.putIfAbsent(destination.getId(), destination);
            }
        });
        return new ArrayList<>(merged.values());
    }

    private List<Destination> filter(List<Destination> destinations, List<String> regions, List<String> styles) {
        return destinations.stream()
                .filter(destination -> regions.isEmpty() || regions.stream().anyMatch(region -> destination.getRegion().equalsIgnoreCase(region)))
                .filter(destination -> styles.isEmpty() || styles.stream().anyMatch(style -> hasStyle(destination, style)))
                .sorted(Comparator.comparing(Destination::getPopularityScore).reversed().thenComparing(Destination::getName))
                .toList();
    }

    private boolean hasStyle(Destination destination, String style) {
        String needle = style.toLowerCase(Locale.ROOT);
        return destination.getPrimaryStyle().toLowerCase(Locale.ROOT).contains(needle)
                || destination.getStyleTags().toLowerCase(Locale.ROOT).contains(needle);
    }

    private boolean hasKeyword(Destination destination, String keyword) {
        String haystack = String.join(" ",
                destination.getName(),
                destination.getRegion(),
                destination.getDistrict(),
                destination.getCategory(),
                destination.getPrimaryStyle(),
                destination.getStyleTags(),
                destination.getAddress(),
                destination.getHeadline(),
                destination.getImageUrl() == null ? "" : destination.getImageUrl(),
                destination.getDescription()).toLowerCase(Locale.ROOT);
        return haystack.contains(keyword);
    }

    private boolean matchesRegion(Destination destination, String region, String areaCode) {
        if (!region.isBlank()) {
            return destination.getRegion().equalsIgnoreCase(region);
        }
        if (areaCode.isBlank()) {
            return true;
        }
        return switch (areaCode) {
            case "1", "서울" -> "서울".equals(destination.getRegion());
            case "6", "부산" -> "부산".equals(destination.getRegion());
            case "35", "경주" -> "경주".equals(destination.getRegion());
            case "39", "제주" -> "제주".equals(destination.getRegion());
            case "도쿄", "tokyo" -> "도쿄".equalsIgnoreCase(destination.getRegion());
            case "교토", "kyoto" -> "교토".equalsIgnoreCase(destination.getRegion());
            case "오사카", "osaka" -> "오사카".equalsIgnoreCase(destination.getRegion());
            case "후쿠오카", "fukuoka" -> "후쿠오카".equalsIgnoreCase(destination.getRegion());
            default -> destination.getRegion().equalsIgnoreCase(areaCode);
        };
    }

    private void applySeed(Destination destination, MockDestination seed) {
        destination.setName(seed.name());
        destination.setRegion(seed.region());
        destination.setDistrict(seed.district());
        destination.setCategory(seed.category());
        destination.setPrimaryStyle(seed.primaryStyle());
        destination.setStyleTags(String.join(",", seed.styleTags()));
        destination.setAddress(seed.address());
        destination.setHeadline(seed.headline());
        destination.setImageUrl(null);
        destination.setDescription(seed.description());
        destination.setRecommendedMinutes(seed.recommendedMinutes());
        destination.setPopularityScore(seed.popularityScore());
        destination.setSource(MOCK_SOURCE);
        destination.setSourceRef(seed.sourceRef());
    }

    private List<MockDestination> mockDestinations() {
        return List.of(
                new MockDestination("SEOUL-001", "경복궁", "서울", "종로구", "궁궐", "역사", List.of("역사", "가족", "사진"), "서울 종로구 사직로 161", "조선 왕궁 중심 동선과 한복 사진 수요가 강한 대표 명소", "오전 고궁 산책과 북촌 이동을 묶기 좋은 서울 역사 코스입니다.", 120, 98),
                new MockDestination("SEOUL-002", "북촌한옥마을", "서울", "종로구", "마을", "사진", List.of("역사", "사진", "커플"), "서울 종로구 계동길 37", "한옥 골목과 전망 포인트가 이어지는 도보 여행지", "좁은 골목 동선이 많아 느린 산책 일정에 잘 맞습니다.", 90, 92),
                new MockDestination("SEOUL-003", "성수 카페거리", "서울", "성동구", "카페", "카페", List.of("카페", "커플", "사진"), "서울 성동구 연무장길", "로스터리와 편집숍을 함께 둘러보는 감성 상권", "비 오는 날에도 실내 체류로 계획을 유지하기 좋습니다.", 100, 91),
                new MockDestination("SEOUL-004", "망원시장", "서울", "마포구", "시장", "맛집", List.of("맛집", "가족", "카페"), "서울 마포구 포은로8길 14", "가벼운 먹거리와 로컬 상점이 밀집한 시장", "점심 전후로 배치하면 간식과 식사를 한 번에 해결할 수 있습니다.", 80, 86),
                new MockDestination("SEOUL-005", "여의도 한강공원", "서울", "영등포구", "공원", "자연", List.of("자연", "가족", "커플"), "서울 영등포구 여의동로 330", "피크닉과 야경 동선을 모두 잡을 수 있는 강변 공원", "아이 동반 일정이나 저녁 산책 일정에 무난합니다.", 100, 88),
                new MockDestination("SEOUL-006", "남산서울타워", "서울", "용산구", "전망대", "커플", List.of("커플", "사진", "가족"), "서울 용산구 남산공원길 105", "서울 도심 야경을 한 번에 보는 전망 명소", "해질녘 이후 일정에 넣으면 만족도가 높습니다.", 90, 90),
                new MockDestination("SEOUL-007", "동대문디자인플라자", "서울", "중구", "건축", "사진", List.of("사진", "커플", "쇼핑"), "서울 중구 을지로 281", "곡선형 건축과 전시, 야간 조명이 강한 도심 명소", "쇼핑과 전시 관람을 함께 넣기 좋아 비 오는 날 대안 코스로도 좋습니다.", 100, 87),
                new MockDestination("SEOUL-008", "청계천", "서울", "종로구", "산책로", "자연", List.of("자연", "커플", "사진"), "서울 종로구 청계천로", "도심 이동 중 짧게 쉬어가기 좋은 수변 산책로", "광화문, 을지로, 동대문 동선을 연결하는 완충 일정으로 적합합니다.", 70, 85),
                new MockDestination("GYEONGJU-001", "불국사", "경주", "진현동", "사찰", "역사", List.of("역사", "가족", "사진"), "경북 경주시 불국로 385", "유네스코 문화유산을 중심으로 한 경주 핵심 방문지", "석굴암이나 보문권 일정과 함께 묶기 좋습니다.", 120, 96),
                new MockDestination("GYEONGJU-002", "동궁과 월지", "경주", "인왕동", "유적", "사진", List.of("역사", "사진", "커플"), "경북 경주시 원화로 102", "야간 반영 사진으로 유명한 신라 왕궁 별궁지", "저녁 시간대에 배치하면 경주 여행의 인상이 강해집니다.", 80, 94),
                new MockDestination("GYEONGJU-003", "첨성대", "경주", "인왕동", "유적", "역사", List.of("역사", "가족", "사진"), "경북 경주시 인왕동 839-1", "대릉원과 월성 사이 도보 이동의 기준점", "짧게 들르기 좋아 하루 동선의 연결 지점으로 적합합니다.", 50, 88),
                new MockDestination("GYEONGJU-004", "황리단길", "경주", "황남동", "거리", "카페", List.of("카페", "맛집", "커플"), "경북 경주시 포석로 1080", "한옥형 카페와 식당이 집중된 경주 대표 상권", "식사와 휴식을 함께 넣는 오후 일정에 잘 맞습니다.", 110, 93),
                new MockDestination("GYEONGJU-005", "보문호수", "경주", "보문동", "호수", "자연", List.of("자연", "가족", "커플"), "경북 경주시 보문로", "리조트권과 연결된 호수 산책 명소", "차량 이동 중 쉬어가는 일정이나 가족 산책에 적합합니다.", 90, 84),
                new MockDestination("GYEONGJU-006", "교촌마을", "경주", "교동", "마을", "맛집", List.of("맛집", "역사", "가족"), "경북 경주시 교촌길 39-2", "전통 가옥과 지역 먹거리를 함께 즐기는 마을", "월정교와 묶으면 저녁 전후 동선이 자연스럽습니다.", 90, 87),
                new MockDestination("GYEONGJU-007", "월정교", "경주", "교동", "교량", "사진", List.of("사진", "역사", "커플"), "경북 경주시 교동 274", "야간 조명과 하천 반영이 인상적인 복원 목조교", "교촌마을과 이어지는 저녁 산책 코스로 만족도가 높습니다.", 70, 89),
                new MockDestination("GYEONGJU-008", "대릉원", "경주", "황남동", "고분", "역사", List.of("역사", "가족", "사진"), "경북 경주시 황남동 31-1", "신라 고분군과 완만한 산책로가 이어지는 중심권 명소", "첨성대, 황리단길과 도보로 묶어 반나절 코스를 만들기 좋습니다.", 100, 91),
                new MockDestination("BUSAN-001", "감천문화마을", "부산", "사하구", "마을", "사진", List.of("사진", "가족", "커플"), "부산 사하구 감내2로 203", "계단식 마을 풍경과 벽화 포인트가 많은 촬영 명소", "오르막이 있어 여유 시간을 확보하는 편이 좋습니다.", 100, 89),
                new MockDestination("BUSAN-002", "해운대해수욕장", "부산", "해운대구", "해변", "자연", List.of("자연", "가족", "커플"), "부산 해운대구 우동", "부산 바다 여행의 기준이 되는 대표 해변", "해변 산책, 식사, 숙소 복귀를 연결하기 쉽습니다.", 120, 95),
                new MockDestination("BUSAN-003", "광안리해변", "부산", "수영구", "해변", "커플", List.of("커플", "카페", "사진"), "부산 수영구 광안해변로", "광안대교 야경과 카페 체류가 강한 해변 상권", "저녁 식사 후 산책 일정으로 넣기 좋습니다.", 110, 93),
                new MockDestination("BUSAN-004", "국제시장", "부산", "중구", "시장", "맛집", List.of("맛집", "가족", "역사"), "부산 중구 신창동4가", "부산 원도심 먹거리와 쇼핑 동선의 핵심 시장", "남포동, 자갈치와 함께 반나절 코스로 묶기 좋습니다.", 100, 88),
                new MockDestination("BUSAN-005", "전포카페거리", "부산", "부산진구", "카페", "카페", List.of("카페", "사진", "커플"), "부산 부산진구 전포대로", "개성 있는 카페와 편집숍이 모인 도심 상권", "서면 식사 전후 휴식 포인트로 쓰기 좋습니다.", 90, 85),
                new MockDestination("BUSAN-006", "태종대", "부산", "영도구", "공원", "자연", List.of("자연", "사진", "가족"), "부산 영도구 전망로 24", "해안 절벽과 등대 전망을 볼 수 있는 자연 명소", "바람이 강한 날이 많아 낮 일정에 배치하는 편이 안정적입니다.", 120, 86),
                new MockDestination("BUSAN-007", "자갈치시장", "부산", "중구", "시장", "맛집", List.of("맛집", "가족", "사진"), "부산 중구 자갈치해안로 52", "해산물 식사와 항구 풍경을 함께 보는 부산 대표 시장", "국제시장, BIFF 거리와 이어 붙이면 원도심 식사 동선이 편합니다.", 90, 90),
                new MockDestination("BUSAN-008", "오륙도 스카이워크", "부산", "남구", "전망대", "자연", List.of("자연", "사진", "가족"), "부산 남구 오륙도로 137", "바다 위 절벽 전망과 유리 전망대 체험이 있는 해안 명소", "맑은 날 낮 일정에 넣으면 사진과 산책 만족도가 높습니다.", 80, 84),
                new MockDestination("JEJU-001", "성산일출봉", "제주", "성산읍", "오름", "자연", List.of("자연", "사진", "가족"), "제주 서귀포시 성산읍 성산리 1", "일출과 분화구 전망을 함께 보는 제주 동부 대표 명소", "이른 시간이나 오전 동선에 배치하면 혼잡을 줄일 수 있습니다.", 120, 97),
                new MockDestination("JEJU-002", "우도", "제주", "우도면", "섬", "자연", List.of("자연", "커플", "사진"), "제주 제주시 우도면", "배 이동과 해안 드라이브가 결합된 섬 여행지", "날씨와 배 시간을 고려해 반나절 이상 확보해야 합니다.", 180, 94),
                new MockDestination("JEJU-003", "협재해변", "제주", "한림읍", "해변", "가족", List.of("가족", "자연", "사진"), "제주 제주시 한림읍 협재리 2497-1", "맑은 물빛과 비양도 전망이 좋은 서부 해변", "아이 동반 물놀이와 카페 휴식을 함께 잡기 좋습니다.", 120, 90),
                new MockDestination("JEJU-004", "동문시장", "제주", "일도일동", "시장", "맛집", List.of("맛집", "가족", "사진"), "제주 제주시 관덕로14길 20", "야시장 먹거리와 기념품 구매를 한 번에 해결하는 시장", "공항 이동 전후 짧은 일정에도 넣기 쉽습니다.", 90, 89),
                new MockDestination("JEJU-005", "애월카페거리", "제주", "애월읍", "카페", "카페", List.of("카페", "커플", "사진"), "제주 제주시 애월읍 애월해안로", "해안 드라이브와 카페 체류가 이어지는 감성 코스", "서부권 드라이브 일정 중 쉬어가는 포인트로 적합합니다.", 110, 91),
                new MockDestination("JEJU-006", "절물자연휴양림", "제주", "봉개동", "휴양림", "자연", List.of("자연", "가족", "사진"), "제주 제주시 명림로 584", "삼나무 숲길과 완만한 산책로가 있는 휴양림", "더운 날에도 숲 그늘이 있어 가족 일정에 안정적입니다.", 100, 84),
                new MockDestination("JEJU-007", "한라산 성판악", "제주", "조천읍", "등산", "자연", List.of("자연", "사진", "혼자"), "제주 제주시 조천읍 516로 1865", "한라산 정상 탐방의 대표 출발 지점", "체력과 예약 여부를 확인하고 이른 오전 단독 일정으로 잡는 편이 안전합니다.", 240, 92),
                new MockDestination("JEJU-008", "카멜리아힐", "제주", "안덕면", "수목원", "사진", List.of("사진", "커플", "가족"), "제주 서귀포시 안덕면 병악로 166", "계절 꽃과 산책로가 잘 정리된 서귀포 정원 명소", "비교적 완만해 가족, 커플 일정의 오후 휴식 코스로 쓰기 좋습니다.", 100, 86),
                new MockDestination("TOKYO-001", "센소지", "도쿄", "아사쿠사", "사찰", "역사", List.of("역사", "사진", "가족"), "東京都台東区浅草2-3-1", "아사쿠사 중심의 도쿄 대표 사찰과 상점가 동선", "나카미세 거리와 묶어 오전 산책 일정으로 쓰기 좋습니다.", 100, 95),
                new MockDestination("TOKYO-002", "시부야 스카이", "도쿄", "시부야", "전망대", "사진", List.of("사진", "커플", "야경"), "東京都渋谷区渋谷2-24-12", "도쿄 도심 전망과 야경을 보는 고층 전망 명소", "해질녘 예약 동선으로 배치하면 만족도가 높습니다.", 90, 93),
                new MockDestination("TOKYO-003", "츠키지 장외시장", "도쿄", "주오구", "시장", "맛집", List.of("맛집", "가족", "사진"), "東京都中央区築地4丁目", "해산물과 전통 식재료를 만나는 도쿄 식도락 시장", "아침 식사나 이른 점심 동선으로 적합합니다.", 90, 91),
                new MockDestination("TOKYO-004", "신주쿠교엔", "도쿄", "신주쿠", "정원", "자연", List.of("자연", "가족", "산책", "사진"), "東京都新宿区内藤町11", "도심 속 넓은 정원과 계절 산책 코스", "시부야·신주쿠 일정 사이에 쉬어가는 낮 일정으로 좋습니다.", 100, 89),
                new MockDestination("TOKYO-005", "우에노공원", "도쿄", "다이토구", "공원", "가족", List.of("가족", "자연", "박물관", "산책"), "東京都台東区上野公園", "박물관과 동물원, 산책로가 모인 가족형 공원", "아이 동반 일정이나 비 오는 날 실내 대안과 함께 잡기 쉽습니다.", 120, 88),
                new MockDestination("TOKYO-006", "하라주쿠 다케시타도리", "도쿄", "하라주쿠", "거리", "쇼핑", List.of("쇼핑", "사진", "커플", "카페"), "東京都渋谷区神宮前1丁目", "개성 있는 상점과 디저트가 모인 젊은 거리", "메이지신궁, 오모테산도와 이어 붙이면 이동이 단순합니다.", 80, 86),
                new MockDestination("TOKYO-007", "오다이바 해변공원", "도쿄", "미나토구", "공원", "야경", List.of("야경", "가족", "사진", "산책"), "東京都港区台場1丁目", "레인보브리지 전망과 쇼핑몰을 함께 보는 해변 공원", "저녁 산책과 실내 쇼핑 대안이 같이 있어 가족 일정에 안정적입니다.", 100, 87),
                new MockDestination("TOKYO-008", "메이지신궁", "도쿄", "시부야", "신사", "역사", List.of("역사", "자연", "가족", "산책"), "東京都渋谷区代々木神園町1-1", "울창한 숲길과 신사 참배 동선이 있는 도심 명소", "하라주쿠와 붙어 있어 오전 산책 후 쇼핑 동선으로 전환하기 좋습니다.", 90, 90),
                new MockDestination("KYOTO-001", "기요미즈데라", "교토", "히가시야마", "사찰", "역사", List.of("역사", "사진", "가족"), "京都府京都市東山区清水1丁目294", "교토 동쪽 산기슭의 대표 사찰과 전망 동선", "니넨자카·산넨자카와 도보로 묶기 좋습니다.", 120, 96),
                new MockDestination("KYOTO-002", "후시미이나리 타이샤", "교토", "후시미", "신사", "사진", List.of("사진", "역사", "자연"), "京都府京都市伏見区深草藪之内町68", "붉은 도리이 터널로 유명한 교토 대표 신사", "이른 오전에 배치하면 혼잡을 줄일 수 있습니다.", 120, 95),
                new MockDestination("KYOTO-003", "니시키시장", "교토", "나카교구", "시장", "맛집", List.of("맛집", "가족", "쇼핑"), "京都府京都市中京区錦小路通", "교토 식재료와 간식을 촘촘히 둘러보는 시장", "점심 전후 간식과 쇼핑을 함께 넣기 좋습니다.", 80, 88),
                new MockDestination("KYOTO-004", "아라시야마 대나무숲", "교토", "우쿄구", "숲길", "자연", List.of("자연", "사진", "커플", "산책"), "京都府京都市右京区嵯峨天龍寺芒ノ馬場町", "대나무숲 산책과 강변 동선이 강한 서쪽 명소", "이른 오전에 가면 혼잡을 줄일 수 있고 텐류지와 함께 묶기 좋습니다.", 110, 92),
                new MockDestination("KYOTO-005", "기온", "교토", "히가시야마", "거리", "산책", List.of("산책", "역사", "커플", "야경"), "京都府京都市東山区祇園町", "전통 거리와 저녁 산책 분위기가 강한 권역", "기요미즈데라 이후 저녁 식사와 함께 잡으면 교토다운 흐름이 납니다.", 90, 89),
                new MockDestination("KYOTO-006", "금각사", "교토", "기타구", "사찰", "역사", List.of("역사", "사진", "가족", "정원"), "京都府京都市北区金閣寺町1", "금빛 누각과 정원 관람이 강한 대표 사찰", "북서쪽 권역이라 료안지나 아라시야마와 같은 날에 묶는 편이 좋습니다.", 90, 90),
                new MockDestination("KYOTO-007", "철학의 길", "교토", "사쿄구", "산책로", "자연", List.of("자연", "산책", "커플", "사진"), "京都府京都市左京区", "운하를 따라 걷는 조용한 동쪽 산책길", "은각사와 난젠지 사이 여유 코스로 좋고 봄철 사진 만족도가 높습니다.", 80, 85),
                new MockDestination("KYOTO-008", "교토역 빌딩", "교토", "시모교구", "건축", "실내", List.of("실내", "쇼핑", "가족", "야경"), "京都府京都市下京区東塩小路町", "교통 허브와 쇼핑, 전망 공간이 합쳐진 실내 거점", "도착일이나 비 오는 날 일정의 완충 지점으로 쓰기 좋습니다.", 80, 84),
                new MockDestination("OSAKA-001", "도톤보리", "오사카", "주오구", "거리", "맛집", List.of("맛집", "야경", "사진"), "大阪府大阪市中央区道頓堀", "간판 야경과 오사카 먹거리가 집중된 대표 거리", "저녁 식사와 야경 산책을 함께 구성하기 좋습니다.", 110, 95),
                new MockDestination("OSAKA-002", "오사카성 공원", "오사카", "주오구", "성곽", "역사", List.of("역사", "가족", "사진"), "大阪府大阪市中央区大阪城1-1", "성곽과 공원 산책을 함께 보는 오사카 대표 명소", "오전 산책과 박물관 관람을 묶기 좋습니다.", 120, 91),
                new MockDestination("OSAKA-003", "신사이바시스지", "오사카", "주오구", "상점가", "쇼핑", List.of("쇼핑", "맛집", "커플", "실내"), "大阪府大阪市中央区心斎橋筋", "비 오는 날에도 걷기 좋은 대표 쇼핑 아케이드", "도톤보리와 가까워 오후 쇼핑 후 저녁 식사로 이어가기 좋습니다.", 90, 88),
                new MockDestination("OSAKA-004", "우메다 스카이빌딩", "오사카", "기타구", "전망대", "야경", List.of("야경", "사진", "커플", "전망"), "大阪府大阪市北区大淀中1-1-88", "공중정원 전망대로 오사카 야경을 보는 명소", "우메다 식사와 함께 저녁 일정으로 넣으면 이동이 효율적입니다.", 90, 87),
                new MockDestination("OSAKA-005", "덴포잔 대관람차", "오사카", "미나토구", "전망대", "가족", List.of("가족", "전망", "사진", "실내"), "大阪府大阪市港区海岸通1丁目", "베이 에어리어 전망과 가족 체험이 쉬운 명소", "가이유칸과 함께 잡으면 아이 동반 반나절 코스로 안정적입니다.", 80, 84),
                new MockDestination("OSAKA-006", "구로몬시장", "오사카", "주오구", "시장", "맛집", List.of("맛집", "시장", "가족", "로컬"), "大阪府大阪市中央区日本橋2丁目", "해산물과 길거리 음식을 맛보는 도심 시장", "난바 근처 점심이나 간식 동선으로 좋고 체류 시간을 조절하기 쉽습니다.", 80, 86),
                new MockDestination("FUKUOKA-001", "오호리공원", "후쿠오카", "주오구", "공원", "자연", List.of("자연", "가족", "산책"), "福岡県福岡市中央区大濠公園", "호수 산책과 도심 휴식이 쉬운 후쿠오카 대표 공원", "카페 휴식과 함께 느린 오후 일정으로 좋습니다.", 90, 88),
                new MockDestination("FUKUOKA-002", "나카스 포장마차 거리", "후쿠오카", "하카타구", "거리", "맛집", List.of("맛집", "야경", "로컬"), "福岡県福岡市博多区中洲", "야타이 문화와 하카타 라멘을 경험하는 저녁 동선", "저녁 이후 짧은 식도락 산책으로 배치하기 좋습니다.", 90, 90),
                new MockDestination("FUKUOKA-003", "다자이후 텐만구", "후쿠오카", "다자이후", "신사", "역사", List.of("역사", "가족", "사진", "근교"), "福岡県太宰府市宰府4丁目7-1", "학문의 신을 모신 근교 대표 신사", "텐진에서 반나절 근교 코스로 잡기 좋고 상점가 간식 동선이 함께 있습니다.", 120, 89),
                new MockDestination("FUKUOKA-004", "모모치해변", "후쿠오카", "사와라구", "해변", "자연", List.of("자연", "사진", "커플", "산책"), "福岡県福岡市早良区百道浜", "도심에서 가까운 해변 산책과 타워 전망 권역", "후쿠오카타워와 묶어 해질녘 산책 일정으로 쓰기 좋습니다.", 90, 85),
                new MockDestination("FUKUOKA-005", "캐널시티 하카타", "후쿠오카", "하카타구", "쇼핑몰", "쇼핑", List.of("쇼핑", "실내", "가족", "맛집"), "福岡県福岡市博多区住吉1丁目2", "쇼핑과 식사, 분수 쇼를 함께 보는 실내 복합몰", "비 오는 날이나 도착일 짧은 일정에 넣기 좋습니다.", 90, 86),
                new MockDestination("FUKUOKA-006", "마린월드 우미노나카미치", "후쿠오카", "히가시구", "수족관", "가족", List.of("가족", "실내", "자연", "체험"), "福岡県福岡市東区西戸崎18-28", "가족 체험에 강한 해양 수족관", "아이 동반이면 반나절 이상 확보하고 우미노나카미치 해변공원과 같이 잡기 좋습니다.", 140, 87),
                new MockDestination("GANGNEUNG-001", "경포해변", "강릉", "안현동", "해변", "자연", List.of("자연", "사진", "가족", "커플"), "강원 강릉시 창해로", "경포호와 해변 산책을 함께 잡는 강릉 대표 바다 코스", "오전 산책이나 해질녘 바다 일정으로 넣기 좋습니다.", 100, 91),
                new MockDestination("GANGNEUNG-002", "안목커피거리", "강릉", "견소동", "카페", "카페", List.of("카페", "사진", "커플", "바다"), "강원 강릉시 창해로14번길", "바다 전망 카페가 이어지는 강릉 대표 휴식 동선", "경포권이나 중앙시장 식사 전후에 배치하기 좋습니다.", 90, 89),
                new MockDestination("GANGNEUNG-003", "오죽헌", "강릉", "죽헌동", "고택", "역사", List.of("역사", "가족", "사진"), "강원 강릉시 율곡로3139번길 24", "율곡 이이와 신사임당 이야기를 따라가는 역사 명소", "아이 동반 교육 여행이나 비 오는 날 실내형 일정에 안정적입니다.", 90, 86),
                new MockDestination("GANGNEUNG-004", "강릉중앙시장", "강릉", "성남동", "시장", "맛집", List.of("맛집", "시장", "가족", "로컬"), "강원 강릉시 금성로 21", "닭강정과 수산 먹거리가 모인 도심 시장", "점심이나 저녁 전후로 지역 먹거리를 빠르게 경험하기 좋습니다.", 80, 88),
                new MockDestination("JEONJU-001", "전주한옥마을", "전주", "완산구", "마을", "역사", List.of("역사", "사진", "맛집", "가족"), "전북 전주시 완산구 기린대로 99", "한옥 골목과 전주 먹거리를 한 번에 묶는 대표 코스", "반나절 이상 머물며 경기전, 전동성당과 함께 보기 좋습니다.", 140, 94),
                new MockDestination("JEONJU-002", "경기전", "전주", "완산구", "유적", "역사", List.of("역사", "사진", "가족"), "전북 전주시 완산구 태조로 44", "조선 왕조 이야기와 한옥마을 산책을 잇는 중심 명소", "한옥마을 방문 전후 짧게 넣기 좋은 역사 일정입니다.", 70, 88),
                new MockDestination("JEONJU-003", "전동성당", "전주", "완산구", "성당", "사진", List.of("사진", "역사", "커플"), "전북 전주시 완산구 태조로 51", "한옥마을 입구에서 만나는 붉은 벽돌 성당 포토 스폿", "경기전과 도보로 이어져 짧은 사진 일정에 적합합니다.", 50, 85),
                new MockDestination("JEONJU-004", "남부시장 청년몰", "전주", "완산구", "시장", "맛집", List.of("맛집", "시장", "쇼핑", "로컬"), "전북 전주시 완산구 풍남문2길 53", "시장 먹거리와 작은 상점이 함께 있는 로컬 상권", "저녁 간식이나 비 오는 날 실내 대안으로 쓰기 좋습니다.", 90, 84),
                new MockDestination("YEOSU-001", "여수밤바다", "여수", "종화동", "해안", "야경", List.of("야경", "사진", "커플", "산책"), "전남 여수시 종화동", "해안 조명과 버스킹 분위기가 강한 여수 대표 야경 동선", "저녁 식사 후 산책 코스로 배치하면 만족도가 높습니다.", 90, 93),
                new MockDestination("YEOSU-002", "오동도", "여수", "수정동", "섬", "자연", List.of("자연", "사진", "가족", "산책"), "전남 여수시 수정동 산1-11", "동백 숲길과 바다 전망을 걷는 여수 핵심 자연 명소", "낮 시간대 산책 일정으로 안정적이고 해상케이블카와 묶기 좋습니다.", 110, 90),
                new MockDestination("YEOSU-003", "돌산공원", "여수", "돌산읍", "공원", "야경", List.of("야경", "사진", "커플"), "전남 여수시 돌산읍 우두리", "돌산대교와 여수항 야경을 내려다보는 전망 공원", "해질녘 이후 짧은 전망 일정으로 넣기 좋습니다.", 70, 86),
                new MockDestination("YEOSU-004", "이순신광장", "여수", "중앙동", "광장", "맛집", List.of("맛집", "역사", "가족", "로컬"), "전남 여수시 중앙동", "지역 간식과 해안 산책이 가까운 도심 광장", "점심 전후 간식과 기념품 동선을 함께 잡기 좋습니다.", 80, 87),
                new MockDestination("SOKCHO-001", "속초해수욕장", "속초", "조양동", "해변", "자연", List.of("자연", "사진", "가족", "커플"), "강원 속초시 해오름로", "도심 접근성이 좋은 동해 바다 산책 코스", "도착일 첫 일정이나 아침 산책으로 넣기 좋습니다.", 90, 90),
                new MockDestination("SOKCHO-002", "속초관광수산시장", "속초", "중앙동", "시장", "맛집", List.of("맛집", "시장", "가족", "로컬"), "강원 속초시 중앙로147번길 12", "닭강정과 해산물 먹거리가 모인 대표 시장", "점심 또는 저녁 식사 후보로 동선을 짜기 쉽습니다.", 90, 91),
                new MockDestination("SOKCHO-003", "영금정", "속초", "동명동", "전망대", "사진", List.of("사진", "자연", "커플", "산책"), "강원 속초시 영금정로 43", "바다 위 정자와 파도 소리를 가까이 보는 전망 명소", "해돋이나 해질녘 짧은 산책 일정에 잘 맞습니다.", 60, 85),
                new MockDestination("SOKCHO-004", "설악산 소공원", "속초", "설악동", "국립공원", "자연", List.of("자연", "가족", "사진", "산책"), "강원 속초시 설악산로 1091", "케이블카와 산책로를 함께 잡는 설악산 입문 코스", "등산이 부담스러운 가족 여행에도 반나절 코스로 쓰기 좋습니다.", 140, 92),
                new MockDestination("INCHEON-001", "송도센트럴파크", "인천", "연수구", "공원", "자연", List.of("자연", "사진", "가족", "커플"), "인천 연수구 컨벤시아대로 160", "도심 수변 공원과 야경을 함께 즐기는 송도 대표 명소", "카페와 식사 동선을 연결하기 쉬워 반나절 코스로 좋습니다.", 100, 89),
                new MockDestination("INCHEON-002", "차이나타운", "인천", "중구", "거리", "맛집", List.of("맛집", "역사", "가족", "사진"), "인천 중구 차이나타운로", "근대 역사와 중식 먹거리가 이어지는 원도심 코스", "개항장 거리와 함께 걸으면 이동이 단순합니다.", 110, 88),
                new MockDestination("INCHEON-003", "월미도", "인천", "중구", "해안", "가족", List.of("가족", "야경", "사진", "체험"), "인천 중구 월미문화로", "바다 산책과 놀이시설을 함께 잡는 가족형 해안 코스", "오후부터 저녁까지 이어지는 짧은 당일치기 일정에 적합합니다.", 120, 86),
                new MockDestination("INCHEON-004", "개항장거리", "인천", "중구", "거리", "역사", List.of("역사", "사진", "카페", "산책"), "인천 중구 개항로", "근대 건축과 카페가 이어지는 도보 여행지", "차이나타운과 묶으면 원도심 역사 코스가 자연스럽습니다.", 90, 84),
                new MockDestination("DAEGU-001", "김광석 다시그리기길", "대구", "중구", "거리", "사진", List.of("사진", "산책", "커플", "카페"), "대구 중구 달구벌대로 2238", "음악 벽화와 골목 카페가 이어지는 대구 대표 산책길", "반월당, 동성로 식사 전후로 짧게 넣기 좋습니다.", 80, 87),
                new MockDestination("DAEGU-002", "서문시장", "대구", "중구", "시장", "맛집", List.of("맛집", "시장", "가족", "로컬"), "대구 중구 큰장로26길 45", "야시장과 분식, 섬유 상권이 강한 대구 대표 시장", "저녁 먹거리 일정이나 비 오는 날 실내 대안으로 좋습니다.", 100, 90),
                new MockDestination("DAEGU-003", "앞산전망대", "대구", "남구", "전망대", "야경", List.of("야경", "사진", "커플", "자연"), "대구 남구 앞산순환로", "대구 도심 야경을 넓게 보는 전망 명소", "해질녘 이후 이동 여유를 두고 배치하는 편이 좋습니다.", 90, 86),
                new MockDestination("DAEGU-004", "수성못", "대구", "수성구", "호수", "자연", List.of("자연", "산책", "가족", "카페"), "대구 수성구 두산동", "호수 산책과 주변 카페·식당을 함께 잡는 휴식 코스", "점심 이후 느린 산책 일정으로 안정적입니다.", 90, 85),
                new MockDestination("GWANGJU-001", "국립아시아문화전당", "광주", "동구", "문화공간", "실내", List.of("실내", "전시", "가족", "사진"), "광주 동구 문화전당로 38", "전시와 공연, 광장 산책을 함께 잡는 광주 중심 문화공간", "비 오는 날이나 가족 문화 일정에 안정적입니다.", 120, 88),
                new MockDestination("GWANGJU-002", "양림동 역사문화마을", "광주", "남구", "마을", "역사", List.of("역사", "사진", "카페", "산책"), "광주 남구 양림동", "근대 건축과 골목 카페가 이어지는 조용한 산책지", "오후 카페 휴식과 함께 묶기 좋습니다.", 100, 86),
                new MockDestination("GWANGJU-003", "1913송정역시장", "광주", "광산구", "시장", "맛집", List.of("맛집", "시장", "로컬", "가족"), "광주 광산구 송정로8번길 13", "레트로 상점과 간식이 모인 기차역 인근 시장", "도착일이나 귀가 전 짧은 먹거리 일정으로 쓰기 좋습니다.", 80, 85),
                new MockDestination("GWANGJU-004", "무등산 증심사권", "광주", "동구", "국립공원", "자연", List.of("자연", "산책", "가족", "사진"), "광주 동구 증심사길", "무등산 입문 산책과 사찰 동선을 함께 잡는 자연 코스", "체력에 맞춰 짧은 산책부터 반나절 일정까지 조절하기 좋습니다.", 140, 89),
                new MockDestination("DAEJEON-001", "한밭수목원", "대전", "서구", "수목원", "자연", List.of("자연", "가족", "사진", "산책"), "대전 서구 둔산대로 169", "도심에서 걷기 좋은 넓은 수목원과 공원 코스", "아이 동반이나 느린 오후 산책 일정에 적합합니다.", 100, 87),
                new MockDestination("DAEJEON-002", "성심당 본점", "대전", "중구", "베이커리", "맛집", List.of("맛집", "카페", "가족", "로컬"), "대전 중구 대종로480번길 15", "대전 대표 베이커리와 원도심 먹거리 동선", "중앙로 주변 산책과 함께 짧게 넣기 좋습니다.", 70, 92),
                new MockDestination("DAEJEON-003", "엑스포과학공원", "대전", "유성구", "공원", "가족", List.of("가족", "실내", "체험", "사진"), "대전 유성구 대덕대로 480", "과학 테마와 한빛탑 주변 산책을 함께 잡는 가족형 명소", "국립중앙과학관과 묶어 반나절 코스로 만들기 좋습니다.", 110, 86),
                new MockDestination("DAEJEON-004", "유성온천거리", "대전", "유성구", "거리", "휴식", List.of("휴식", "가족", "커플", "산책"), "대전 유성구 온천로", "온천 족욕과 식사 동선이 가까운 휴식형 거리", "여행 마지막 날 피로를 줄이는 완충 일정으로 적합합니다.", 80, 84));
    }

    private record MockDestination(
            String sourceRef,
            String name,
            String region,
            String district,
            String category,
            String primaryStyle,
            List<String> styleTags,
            String address,
            String headline,
            String description,
            Integer recommendedMinutes,
            Integer popularityScore) {
    }
}
