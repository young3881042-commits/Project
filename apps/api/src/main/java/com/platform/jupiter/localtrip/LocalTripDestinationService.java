package com.platform.jupiter.localtrip;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
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
        int pageSize = Math.min(100, Math.max(1, size == null ? 50 : size));
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
        if (all.isEmpty()) {
            syncMockDestinations();
            all = destinationRepository.findAllByOrderByRegionAscPopularityScoreDescNameAsc();
        }

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
        destination.setImageUrl(defaultImageUrl(seed.sourceRef()));
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
                new MockDestination("GYEONGJU-001", "불국사", "경주", "진현동", "사찰", "역사", List.of("역사", "가족", "사진"), "경북 경주시 불국로 385", "유네스코 문화유산을 중심으로 한 경주 핵심 방문지", "석굴암이나 보문권 일정과 함께 묶기 좋습니다.", 120, 96),
                new MockDestination("GYEONGJU-002", "동궁과 월지", "경주", "인왕동", "유적", "사진", List.of("역사", "사진", "커플"), "경북 경주시 원화로 102", "야간 반영 사진으로 유명한 신라 왕궁 별궁지", "저녁 시간대에 배치하면 경주 여행의 인상이 강해집니다.", 80, 94),
                new MockDestination("GYEONGJU-003", "첨성대", "경주", "인왕동", "유적", "역사", List.of("역사", "가족", "사진"), "경북 경주시 인왕동 839-1", "대릉원과 월성 사이 도보 이동의 기준점", "짧게 들르기 좋아 하루 동선의 연결 지점으로 적합합니다.", 50, 88),
                new MockDestination("GYEONGJU-004", "황리단길", "경주", "황남동", "거리", "카페", List.of("카페", "맛집", "커플"), "경북 경주시 포석로 1080", "한옥형 카페와 식당이 집중된 경주 대표 상권", "식사와 휴식을 함께 넣는 오후 일정에 잘 맞습니다.", 110, 93),
                new MockDestination("GYEONGJU-005", "보문호수", "경주", "보문동", "호수", "자연", List.of("자연", "가족", "커플"), "경북 경주시 보문로", "리조트권과 연결된 호수 산책 명소", "차량 이동 중 쉬어가는 일정이나 가족 산책에 적합합니다.", 90, 84),
                new MockDestination("GYEONGJU-006", "교촌마을", "경주", "교동", "마을", "맛집", List.of("맛집", "역사", "가족"), "경북 경주시 교촌길 39-2", "전통 가옥과 지역 먹거리를 함께 즐기는 마을", "월정교와 묶으면 저녁 전후 동선이 자연스럽습니다.", 90, 87),
                new MockDestination("BUSAN-001", "감천문화마을", "부산", "사하구", "마을", "사진", List.of("사진", "가족", "커플"), "부산 사하구 감내2로 203", "계단식 마을 풍경과 벽화 포인트가 많은 촬영 명소", "오르막이 있어 여유 시간을 확보하는 편이 좋습니다.", 100, 89),
                new MockDestination("BUSAN-002", "해운대해수욕장", "부산", "해운대구", "해변", "자연", List.of("자연", "가족", "커플"), "부산 해운대구 우동", "부산 바다 여행의 기준이 되는 대표 해변", "해변 산책, 식사, 숙소 복귀를 연결하기 쉽습니다.", 120, 95),
                new MockDestination("BUSAN-003", "광안리해변", "부산", "수영구", "해변", "커플", List.of("커플", "카페", "사진"), "부산 수영구 광안해변로", "광안대교 야경과 카페 체류가 강한 해변 상권", "저녁 식사 후 산책 일정으로 넣기 좋습니다.", 110, 93),
                new MockDestination("BUSAN-004", "국제시장", "부산", "중구", "시장", "맛집", List.of("맛집", "가족", "역사"), "부산 중구 신창동4가", "부산 원도심 먹거리와 쇼핑 동선의 핵심 시장", "남포동, 자갈치와 함께 반나절 코스로 묶기 좋습니다.", 100, 88),
                new MockDestination("BUSAN-005", "전포카페거리", "부산", "부산진구", "카페", "카페", List.of("카페", "사진", "커플"), "부산 부산진구 전포대로", "개성 있는 카페와 편집숍이 모인 도심 상권", "서면 식사 전후 휴식 포인트로 쓰기 좋습니다.", 90, 85),
                new MockDestination("BUSAN-006", "태종대", "부산", "영도구", "공원", "자연", List.of("자연", "사진", "가족"), "부산 영도구 전망로 24", "해안 절벽과 등대 전망을 볼 수 있는 자연 명소", "바람이 강한 날이 많아 낮 일정에 배치하는 편이 안정적입니다.", 120, 86),
                new MockDestination("JEJU-001", "성산일출봉", "제주", "성산읍", "오름", "자연", List.of("자연", "사진", "가족"), "제주 서귀포시 성산읍 성산리 1", "일출과 분화구 전망을 함께 보는 제주 동부 대표 명소", "이른 시간이나 오전 동선에 배치하면 혼잡을 줄일 수 있습니다.", 120, 97),
                new MockDestination("JEJU-002", "우도", "제주", "우도면", "섬", "자연", List.of("자연", "커플", "사진"), "제주 제주시 우도면", "배 이동과 해안 드라이브가 결합된 섬 여행지", "날씨와 배 시간을 고려해 반나절 이상 확보해야 합니다.", 180, 94),
                new MockDestination("JEJU-003", "협재해변", "제주", "한림읍", "해변", "가족", List.of("가족", "자연", "사진"), "제주 제주시 한림읍 협재리 2497-1", "맑은 물빛과 비양도 전망이 좋은 서부 해변", "아이 동반 물놀이와 카페 휴식을 함께 잡기 좋습니다.", 120, 90),
                new MockDestination("JEJU-004", "동문시장", "제주", "일도일동", "시장", "맛집", List.of("맛집", "가족", "사진"), "제주 제주시 관덕로14길 20", "야시장 먹거리와 기념품 구매를 한 번에 해결하는 시장", "공항 이동 전후 짧은 일정에도 넣기 쉽습니다.", 90, 89),
                new MockDestination("JEJU-005", "애월카페거리", "제주", "애월읍", "카페", "카페", List.of("카페", "커플", "사진"), "제주 제주시 애월읍 애월해안로", "해안 드라이브와 카페 체류가 이어지는 감성 코스", "서부권 드라이브 일정 중 쉬어가는 포인트로 적합합니다.", 110, 91),
                new MockDestination("JEJU-006", "절물자연휴양림", "제주", "봉개동", "휴양림", "자연", List.of("자연", "가족", "사진"), "제주 제주시 명림로 584", "삼나무 숲길과 완만한 산책로가 있는 휴양림", "더운 날에도 숲 그늘이 있어 가족 일정에 안정적입니다.", 100, 84));
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

    private String defaultImageUrl(String sourceRef) {
        return switch (sourceRef) {
            case "SEOUL-001" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Gyeongbokgung%20Palace%20Main%20Gate.jpg?width=1200";
            case "SEOUL-002" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bukchon%20Hanok%20Village%2005.jpg?width=1200";
            case "SEOUL-003" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Cafe%20storefront%20in%20Seongsu-dong.jpg?width=1200";
            case "BUSAN-001" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Gamcheon%20culture%20village.jpg?width=1200";
            case "JEJU-001" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Seongsan%20Ilchulbong%2001.jpg?width=1200";
            case "GYEONGJU-001" -> "https://commons.wikimedia.org/wiki/Special:Redirect/file/Bulguksa%20temple%20main%20building.jpg?width=1200";
            default -> null;
        };
    }
}
