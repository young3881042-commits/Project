package com.platform.jupiter.localtrip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.chat.ChatUsage;
import com.platform.jupiter.chat.ChatUsageService;
import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.rag.RagQueryRequest;
import com.platform.jupiter.rag.RagService;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TravelPlanService {
    private static final List<FallbackSlot> FALLBACK_SLOTS = List.of(
            new FallbackSlot("08:30-09:20", "아침 식당", 50),
            new FallbackSlot("09:50-11:20", "관광지", 90),
            new FallbackSlot("12:00-13:10", "점심 식당", 70),
            new FallbackSlot("13:50-15:10", "관광지", 80),
            new FallbackSlot("15:20-15:50", "간식", 30),
            new FallbackSlot("16:10-16:55", "카페", 45),
            new FallbackSlot("18:00-19:10", "저녁 식당", 70));
    private static final List<FixedPlanSlot> OSAKA_KYOTO_COUPLE_SLOTS = List.of(
            new FixedPlanSlot(1, "08:40-09:20", "간사이국제공항 아침", "오사카", "아침 식당", 40, "입국 후 공항에서 간단히 아침을 먹고 난바 이동권과 짐 동선을 정리합니다."),
            new FixedPlanSlot(1, "09:30-11:10", "간사이국제공항에서 난바 이동", "오사카", "이동", 100, "라피트 또는 공항급행으로 난바까지 이동하고 숙소에 짐을 맡깁니다. 첫날은 이동 완충 시간을 크게 둡니다."),
            new FixedPlanSlot(1, "12:10-13:10", "구로몬시장", "오사카", "점심 식당", 60, "난바 도착 후 해산물과 시장 먹거리로 점심을 해결합니다. 추천 메뉴: 참치, 해산물 구이, 타코야키."),
            new FixedPlanSlot(1, "13:50-15:00", "신사이바시스지", "오사카", "관광지", 70, "도톤보리 전 쇼핑 아케이드에서 실내 산책과 기념품 후보를 봅니다. 비가 와도 동선 유지가 쉽습니다."),
            new FixedPlanSlot(1, "15:10-15:40", "도톤보리 타코야키", "오사카", "간식", 30, "저녁 전 과하지 않게 오사카 대표 간식을 하나만 넣습니다. 추천 메뉴: 타코야키."),
            new FixedPlanSlot(1, "16:00-16:50", "리쿠로오지상 난바 본점", "오사카", "카페", 50, "숙소 체크인 전후로 쉬어가기 좋은 난바 디저트 후보입니다. 추천 메뉴: 치즈케이크, 커피."),
            new FixedPlanSlot(1, "18:00-19:20", "도톤보리", "오사카", "저녁 식당", 80, "간판 야경이 켜지는 시간에 저녁 식사와 사진을 함께 잡습니다. 추천 메뉴: 오코노미야키, 쿠시카츠."),
            new FixedPlanSlot(2, "08:30-09:20", "난바 아침 식당", "오사카", "아침 식당", 50, "오사카성 이동 전 숙소 근처에서 무리 없는 아침을 잡습니다. 추천 메뉴: 일본식 정식, 토스트 세트."),
            new FixedPlanSlot(2, "09:50-11:30", "오사카성 공원", "오사카", "관광지", 100, "혼잡 전 성곽과 공원 산책을 먼저 봅니다. 박물관 관람은 체력과 날씨에 맞춰 선택하세요."),
            new FixedPlanSlot(2, "12:10-13:10", "미즈노", "오사카", "점심 식당", 70, "오사카식 점심 후보입니다. 추천 메뉴: 오코노미야키, 야키소바. 웨이팅이 길면 주변 식당으로 바꿉니다."),
            new FixedPlanSlot(2, "13:50-14:50", "나카노시마·기타하마 산책", "오사카", "관광지", 60, "강변과 근대 건축을 보며 걷는 조용한 오후 코스입니다. 오사카성 뒤 피로를 낮추기 좋습니다."),
            new FixedPlanSlot(2, "15:05-15:35", "고카니 기타하마 본관", "오사카", "간식", 30, "기타하마 동선에서 짧게 넣는 디저트 간식입니다. 추천 메뉴: 케이크, 구움과자."),
            new FixedPlanSlot(2, "15:45-16:30", "SOT COFFEE Osaka Kitahama", "오사카", "카페", 45, "기타하마 산책 중 쉬어가는 하루 1곳 카페 후보입니다. 추천 메뉴: 스페셜티 커피, 라테."),
            new FixedPlanSlot(2, "17:40-18:40", "우메다 스카이빌딩", "오사카", "관광지", 60, "해 질 무렵 공중정원 전망대로 이동합니다. 날씨가 흐리면 헵파이브나 쇼핑몰로 대체하세요."),
            new FixedPlanSlot(2, "19:10-20:20", "우메다 식당가", "오사카", "저녁 식당", 70, "우메다에서 저녁을 먹고 난바 숙소로 복귀합니다. 추천 메뉴: 라멘, 이자카야 메뉴, 오사카식 정식."),
            new FixedPlanSlot(3, "08:20-09:00", "난바 아침 식당", "오사카", "아침 식당", 40, "체크아웃 전 숙소 근처에서 빠르게 아침을 먹고 짐을 정리합니다."),
            new FixedPlanSlot(3, "09:00-10:20", "오사카에서 교토 이동", "교토", "이동", 80, "난바 숙소 체크아웃 후 교토 숙소 또는 역에 짐을 맡깁니다. 60~90분 완충 시간을 둡니다."),
            new FixedPlanSlot(3, "10:50-12:00", "후시미이나리 타이샤", "교토", "관광지", 70, "오전 비교적 이른 시간에 붉은 도리이 길을 걷습니다. 정상까지 무리하지 말고 체력에 맞춰 돌아옵니다."),
            new FixedPlanSlot(3, "12:40-13:30", "니시키시장", "교토", "점심 식당", 50, "교토식 반찬과 두부 메뉴 등 가벼운 점심을 고릅니다. 붐비면 짧게 통과하세요."),
            new FixedPlanSlot(3, "14:20-15:35", "기요미즈데라", "교토", "관광지", 75, "히가시야마 대표 사찰과 전망을 봅니다. 언덕길이 있어 물과 휴식 시간을 챙기세요."),
            new FixedPlanSlot(3, "15:45-16:15", "니넨자카·산넨자카 말차 간식", "교토", "간식", 30, "기요미즈데라에서 내려오며 과하지 않은 말차 디저트나 기념 간식을 잡습니다."),
            new FixedPlanSlot(3, "16:25-17:10", "아라비카 교토 히가시야마", "교토", "카페", 45, "히가시야마 동선에서 하루 1곳 카페 휴식으로 걷는 피로를 낮춥니다. 추천 메뉴: 커피, 라테."),
            new FixedPlanSlot(3, "17:30-18:10", "기온", "교토", "관광지", 40, "해 질 무렵 전통 거리 분위기를 느끼며 짧게 걷습니다. 사유지 촬영과 통행 예절을 지킵니다."),
            new FixedPlanSlot(3, "18:30-19:40", "폰토초 식당가", "교토", "저녁 식당", 70, "가모가와 근처 저녁 후보입니다. 추천 메뉴: 야키토리, 소바, 교토식 정식."),
            new FixedPlanSlot(4, "08:30-09:10", "교토 아침 식당", "교토", "아침 식당", 40, "체크아웃 전 가볍게 아침을 먹고 짐 보관 시간을 확보합니다."),
            new FixedPlanSlot(4, "09:40-10:50", "아라시야마 대나무숲", "교토", "관광지", 70, "오전 산책으로 대나무숲을 먼저 봅니다. 사람이 많으면 도게츠교와 강변 쪽으로 빠르게 이동합니다."),
            new FixedPlanSlot(4, "11:00-11:40", "도게츠교", "교토", "관광지", 40, "강변과 다리 전망을 보며 사진을 남깁니다. 바람이 강하면 체류 시간을 줄입니다."),
            new FixedPlanSlot(4, "12:00-13:00", "아라시야마 점심 식당 후보", "교토", "점심 식당", 60, "강변 또는 역 주변에서 점심을 해결합니다. 추천 메뉴: 우동, 소바, 두부 요리."),
            new FixedPlanSlot(4, "13:20-13:50", "아라시야마 말차 간식", "교토", "간식", 30, "귀국 전 부담 없는 말차 아이스크림이나 지역 간식을 짧게 넣습니다."),
            new FixedPlanSlot(4, "14:00-14:40", "아라비카 교토 아라시야마", "교토", "카페", 40, "귀국 전 하루 1곳 카페 휴식 후보입니다. 추천 메뉴: 커피, 라테."),
            new FixedPlanSlot(4, "15:30-16:30", "교토역 빌딩", "교토", "관광지", 60, "기념품, 식사, 전망 공간을 한 번에 정리합니다. 공항 이동 전 마지막 완충 구간입니다."),
            new FixedPlanSlot(4, "17:00-18:00", "교토역 이른 저녁", "교토", "저녁 식당", 60, "공항 이동 전 역 주변에서 이른 저녁을 해결합니다. 추천 메뉴: 라멘, 오므라이스, 도시락."),
            new FixedPlanSlot(4, "18:10-19:40", "간사이공항 또는 다음 목적지 이동", "교토", "이동", 90, "항공편 시간에 맞춰 교토역에서 이동합니다. 국제선은 여유 있게 출발하세요."));
    private static final String PLAN_PROVIDER = "openai";
    private static final String ADMIN_PLAN_KEY_USERNAME = "admin1";
    private static final String CODEX_CLI_PATH = "/opt/jupiter-cli/bin/codex";
    private static final int MAX_OUTPUT_TOKENS = 3000;
    private static final int CODEX_TIMEOUT_SECONDS = 180;

    private final TravelPlanRepository travelPlanRepository;
    private final TravelPlanItemRepository travelPlanItemRepository;
    private final LocalTripDestinationService destinationService;
    private final LocalTripRealPlaceService realPlaceService;
    private final LocalTripSchemaService schemaService;
    private final ChatCredentialService chatCredentialService;
    private final ChatUsageService chatUsageService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final RagService ragService;
    private final HttpClient httpClient;

    public TravelPlanService(
            TravelPlanRepository travelPlanRepository,
            TravelPlanItemRepository travelPlanItemRepository,
            LocalTripDestinationService destinationService,
            LocalTripRealPlaceService realPlaceService,
            LocalTripSchemaService schemaService,
            ChatCredentialService chatCredentialService,
            ChatUsageService chatUsageService,
            AppProperties appProperties,
            ObjectMapper objectMapper,
            RagService ragService) {
        this.travelPlanRepository = travelPlanRepository;
        this.travelPlanItemRepository = travelPlanItemRepository;
        this.destinationService = destinationService;
        this.realPlaceService = realPlaceService;
        this.schemaService = schemaService;
        this.chatCredentialService = chatCredentialService;
        this.chatUsageService = chatUsageService;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.ragService = ragService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @Transactional
    public TravelPlanResponse generate(TravelPlanGenerateRequest request) {
        return generate(request, "admin");
    }

    @Transactional
    public TravelPlanResponse generate(TravelPlanGenerateRequest request, String username) {
        schemaService.ensureSchema();
        int days = request.days() == null ? 2 : request.days();
        int travelerCount = request.travelerCount() == null ? 2 : request.travelerCount();
        String travelerType = defaultText(request.travelerType(), "커플");
        String pace = defaultText(request.pace(), "보통");
        List<String> regions = normalizeRegions(request);
        List<String> styles = normalizeStyles(request);
        
        String regionLabel = regions.isEmpty() ? "전국" : String.join("·", regions);
        String stylesLabel = styles.isEmpty() ? "추천" : String.join(",", styles);
        boolean osakaKyotoCouplePreset = isOsakaKyotoCouplePreset(regionLabel, days, travelerType, request);

        TravelPlan plan = new TravelPlan();
        plan.setUsername(username);
        plan.setTitle(osakaKyotoCouplePreset ? "오사카·교토 부부 3박4일 여행 코스" : regionLabel + " " + days + "일 LocalTrip AI 일정");
        plan.setRegion(regionLabel);
        plan.setStyles(stylesLabel);
        plan.setDays(days);
        plan.setTravelerCount(travelerCount);
        plan.setTravelerType(travelerType);
        plan.setPace(pace);
        plan.setStartPlace(limitText(defaultText(request.startPlace(), ""), 120));
        plan.setStartAddress(limitText(defaultText(request.startAddress(), ""), 255));
        plan.setEndPlace(limitText(defaultText(request.endPlace(), ""), 120));
        plan.setEndAddress(limitText(defaultText(request.endAddress(), ""), 255));
        plan.setDepartureTime(limitText(defaultText(request.departureTime(), request.dayStartTime()), 20));
        plan.setArrivalTime(limitText(defaultText(request.arrivalTime(), request.dayEndTime()), 20));
        plan.setEstimatedBudget(estimateBudget(days, travelerCount, request.budgetLevel(), request.transportType()));
        plan.setSummary(osakaKyotoCouplePreset
                ? "난바 먹거리, 오사카성·우메다 야경, 교토 히가시야마와 아라시야마를 부부 여행 속도에 맞춰 묶은 3박4일 일정입니다."
                : regionLabel + "의 " + stylesLabel + " 취향을 반영한 " + travelerType + "용 "
                        + pace + " 속도 추천 일정입니다.");
        TravelPlan savedPlan = travelPlanRepository.save(plan);
        List<Destination> destinations = destinationService.findCandidatesForPlan(request.destinationIds(), regions, styles);

        List<TravelPlanItem> items = osakaKyotoCouplePreset
                ? osakaKyotoCoupleItems(savedPlan, destinations)
                : applyVerifiedFoodPlaces(savedPlan, generateItineraryWithLocalGpt(savedPlan, request, username, destinations));
        travelPlanItemRepository.saveAll(items);

        return TravelPlanResponse.from(savedPlan, travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(savedPlan.getId()), destinations);
    }

    private List<TravelPlanItem> generateItineraryWithLocalGpt(TravelPlan plan, TravelPlanGenerateRequest request, String username, List<Destination> candidates) {
        String prompt = buildPrompt(plan, request, candidates);
        String apiKey = resolveTravelPlanOpenAiApiKey(username);
        if (Boolean.TRUE.equals(appProperties.enableCodexCliMode())) {
            List<TravelPlanItem> codexItems = generateItineraryWithCodexCli(plan, prompt, candidates, apiKey);
            if (!codexItems.isEmpty()) {
                return codexItems;
            }
        }
        try {
            String model = openAiChatModel();
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", model);
            payload.put("max_tokens", MAX_OUTPUT_TOKENS);
            payload.put("temperature", 0.35);
            payload.put(
                "messages",
                List.of(
                    Map.of("role", "system", "content", "너는 한국과 일본 현지 여행 전문 가이드 AI다. 반드시 요청받은 JSON 형식으로만 답변해라."),
                    Map.of("role", "user", "content", prompt)
                )
            );

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(appProperties.codexApiBaseUrl()) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(
                        openAiFailureStatus(response.statusCode()),
                        "OpenAI 여행 코스 생성에 실패했습니다. " + summarizeOpenAiError(response.statusCode(), response.body()));
            }

            JsonNode root = objectMapper.readTree(response.body());
            chatUsageService.recordUsage(username, PLAN_PROVIDER, model, extractUsage(root));
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            
            if (content.contains("```json")) {
                content = content.substring(content.indexOf("```json") + 7);
                content = content.substring(0, content.lastIndexOf("```"));
            } else if (content.contains("```")) {
                content = content.substring(content.indexOf("```") + 3);
                content = content.substring(0, content.lastIndexOf("```"));
            }

            List<TravelPlanItem> items;
            try {
                items = parseGeneratedItems(plan, content, candidates);
            } catch (IOException parseException) {
                return fallbackItems(plan, candidates);
            }
            return items.isEmpty() ? fallbackItems(plan, candidates) : items;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI API 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI API 요청이 중단되었습니다. 다시 시도해 주세요.", e);
        } catch (Exception e) {
            return fallbackItems(plan, candidates);
        }
    }

    private List<TravelPlanItem> generateItineraryWithCodexCli(TravelPlan plan, String prompt, List<Destination> candidates, String apiKey) {
        try {
            Path outputPath = Files.createTempFile("localtrip-codex-", ".json");
            ProcessBuilder builder = new ProcessBuilder(
                    CODEX_CLI_PATH,
                    "exec",
                    "--skip-git-repo-check",
                    "--ephemeral",
                    "--ignore-rules",
                    "-m",
                    codexModel(),
                    "-o",
                    outputPath.toString(),
                    prompt);
            builder.redirectErrorStream(true);
            Map<String, String> environment = builder.environment();
            environment.put("CI", "1");
            environment.put("NO_COLOR", "1");
            environment.put("TERM", "dumb");
            environment.put("HOME", "/root");
            environment.put("OPENAI_API_KEY", apiKey);
            environment.put("CODEX_MODEL", codexModel());
            Process process = builder.start();
            process.getOutputStream().close();
            boolean completed = process.waitFor(CODEX_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                Files.deleteIfExists(outputPath);
                return List.of();
            }
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                Files.deleteIfExists(outputPath);
                return List.of();
            }
            String lastMessage = Files.exists(outputPath)
                    ? Files.readString(outputPath, StandardCharsets.UTF_8)
                    : "";
            Files.deleteIfExists(outputPath);
            return parseGeneratedItems(plan, lastMessage.isBlank() ? output : lastMessage, candidates);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String resolveTravelPlanOpenAiApiKey(String username) {
        return resolveDefaultOpenAiApiKey()
                .or(() -> chatCredentialService.resolveOpenAiApiKey(username))
                .or(() -> ADMIN_PLAN_KEY_USERNAME.equals(username)
                        ? Optional.empty()
                        : chatCredentialService.resolveOpenAiApiKey(ADMIN_PLAN_KEY_USERNAME))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "여행 계획 생성용 기본 OpenAI API 키가 필요합니다. APP_OPENAI_API_KEY 또는 OPENAI_API_KEY를 설정해 주세요."));
    }

    private Optional<String> resolveDefaultOpenAiApiKey() {
        String apiKey = appProperties.openAiApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(apiKey.trim()).filter(value -> !value.isBlank());
    }

    private String buildPrompt(TravelPlan plan, TravelPlanGenerateRequest request, List<Destination> candidates) {
        String candidateNames = candidates.stream()
                .limit(16)
                .map(destination -> destination.getName() + "(" + destination.getRegion() + " " + destination.getDistrict()
                        + "/" + destination.getPrimaryStyle() + "/" + destination.getRecommendedMinutes() + "분)")
                .collect(java.util.stream.Collectors.joining(", "));
        String ragContext = localTripRagContext(plan, request);
        String dailyRouteContext = dailyRouteContext(request);
        return String.format(
            "한국 또는 일본 여행 일정을 JSON 배열로 생성해줘.\n" +
            "- 지역: %s\n" +
            "- 기간: %d일\n" +
            "- 동행: %s\n" +
            "- 선호: %s\n" +
            "- 속도: %s\n" +
            "- 이동수단: %s\n" +
            "- 예산: %s\n" +
            "- 식사 취향: %s\n" +
            "- 휴식 기준: %s\n" +
            "- 하루 운영 시간: %s ~ %s\n" +
            "- 꼭 반영할 것: %s\n" +
            "- 피하고 싶은 것: %s\n" +
            "- 일자별 출발/도착 조건:\n%s\n" +
            "- 메모: %s\n" +
            "- 우선 사용할 장소 후보: %s\n\n" +
            "RAG 검색 문맥:\n%s\n\n" +
            "각 날짜는 현실적인 6~7개 핵심 블록으로 구성해. 장거리 이동이 있는 날만 이동 블록을 별도로 1개 추가할 수 있어.\n" +
            "매일 아침 식당, 점심 식당, 저녁 식당을 각각 1개씩 넣고, 카페는 하루 1곳만 넣어. 간식/시장 먹거리는 카페와 별개로 짧은 1블록만 넣어.\n" +
            "식사와 카페/간식을 제외한 나머지는 관광지, 산책, 전망, 쇼핑 같은 실제 방문지로 채워. 같은 날 주요 관광지는 2~3곳을 넘기지 마.\n" +
            "장소 사이에는 대중교통/도보 이동과 대기 시간을 합쳐 최소 20~40분 완충을 둬. 서로 먼 구역을 같은 날 여러 번 왕복하지 마.\n" +
            "각 날짜의 첫 블록은 해당 날짜 출발지와 출발 시간 이후로 시작하고, 마지막 블록은 해당 날짜 도착지와 도착 시간 전에 끝나게 해.\n" +
            "RAG 문맥이 지역, 동행, 취향과 맞으면 우선 반영하고, 맞지 않는 문맥은 억지로 쓰지 마.\n" +
            "timeSlot은 09:30-10:50 같은 시간 범위로 쓰고, 같은 날 시간이 겹치면 안 돼.\n" +
            "식당, 카페, 간식은 이름이 확인 가능한 실제 영업 장소명만 써. '로컬 식당', '카페 추천', '아침 식당 후보' 같은 일반명은 금지야.\n" +
            "각 블록 note에는 이전 장소에서 출발하는 시간, 이번 장소 도착 시간, 이동 팁을 포함해. 식당/카페/간식은 추천 메뉴도 함께 써.\n" +
            "destinationName은 선택한 국가와 지역에 맞는 실제 장소명으로 쓰고 note는 추천 이유, 이동 팁, 체류 포인트 또는 추천 메뉴를 포함해 120자 이하로 구체적으로 써.\n" +
            "durationMinutes는 해당 블록의 권장 체류 시간을 분 단위 숫자로 써.\n" +
            "primaryStyle은 아침 식당, 점심 식당, 저녁 식당, 카페, 간식, 관광지, 산책, 이동 중 가장 가까운 값을 써.\n" +
            "API 키, 토큰, 서버 주소, 내부 설정 같은 민감정보는 절대 포함하지 마.\n" +
            "형식: [{\"dayNumber\": 1, \"timeSlot\": \"09:30-10:50\", \"destinationName\": \"장소\", \"note\": \"설명\", \"primaryStyle\": \"관광지\", \"durationMinutes\": 80}, ...]",
            plan.getRegion(),
            plan.getDays(),
            plan.getTravelerType(),
            plan.getStyles(),
            plan.getPace(),
            defaultText(request.transportType(), "대중교통"),
            defaultText(request.budgetLevel(), "보통"),
            defaultText(request.mealPreference(), "지역 대표 음식과 실제 식당"),
            defaultText(request.restPreference(), "중간 휴식 포함"),
            defaultText(request.dayStartTime(), defaultText(request.departureTime(), "09:30")),
            defaultText(request.dayEndTime(), defaultText(request.arrivalTime(), "21:00")),
            defaultText(request.mustVisit(), "없음"),
            defaultText(request.avoid(), "없음"),
            dailyRouteContext,
            defaultText(request.memo(), "없음"),
            candidateNames.isBlank() ? "지역 대표 명소" : candidateNames,
            ragContext.isBlank() ? "(관련 RAG 문맥 없음)" : ragContext
        );
    }

    private String dailyRouteContext(TravelPlanGenerateRequest request) {
        if (request.dailyRoutes() == null || request.dailyRoutes().isEmpty()) {
            return "(일자별 조건 없음)";
        }
        return request.dailyRoutes().stream()
                .limit(7)
                .map(route -> String.format(
                        "  - %d일차: 출발지=%s / 주소=%s / 출발시간=%s, 도착지=%s / 주소=%s / 도착시간=%s",
                        route.day() == null ? 1 : route.day(),
                        defaultText(route.startPlace(), "미정"),
                        defaultText(route.startAddress(), "미정"),
                        defaultText(route.departureTime(), "미정"),
                        defaultText(route.endPlace(), "미정"),
                        defaultText(route.endAddress(), "미정"),
                        defaultText(route.arrivalTime(), "미정")))
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private String localTripRagContext(TravelPlan plan, TravelPlanGenerateRequest request) {
        String question = String.join(" ",
                "LocalTrip 여행 일정 추천",
                defaultText(plan.getRegion(), ""),
                defaultText(plan.getTravelerType(), ""),
                defaultText(plan.getPace(), ""),
                defaultText(plan.getStyles(), ""),
                defaultText(request.budgetLevel(), ""),
                defaultText(request.memo(), ""));
        try {
            return ragService.retrieve(new RagQueryRequest(question, 4)).candidates().stream()
                    .filter(chunk -> chunk.documentId().contains("localtrip"))
                    .limit(4)
                    .map(chunk -> "- " + limitText(chunk.text(), 360))
                    .collect(java.util.stream.Collectors.joining("\n"));
        } catch (Exception ignored) {
            return "";
        }
    }

    private String estimateBudget(int days, int travelerCount, String budgetLevel, String transportType) {
        int levelBase = switch (defaultText(budgetLevel, "보통")) {
            case "절약" -> 85000;
            case "프리미엄" -> 220000;
            default -> 140000;
        };
        int transportBase = switch (defaultText(transportType, "대중교통")) {
            case "자동차" -> 45000;
            case "도보" -> 12000;
            default -> 25000;
        };
        int total = Math.max(1, days) * Math.max(1, travelerCount) * levelBase
                + Math.max(1, days) * transportBase;
        int low = Math.max(10000, (int) Math.round(total * 0.9 / 10000.0) * 10000);
        int high = Math.max(low, (int) Math.round(total * 1.15 / 10000.0) * 10000);
        return String.format("%,d원 ~ %,d원", low, high);
    }

    private ChatUsage extractUsage(JsonNode root) {
        JsonNode usage = root.path("usage");
        long inputTokens = firstPositive(
                usage.path("prompt_tokens").asLong(-1),
                usage.path("input_tokens").asLong(-1));
        long outputTokens = firstPositive(
                usage.path("completion_tokens").asLong(-1),
                usage.path("output_tokens").asLong(-1));
        long totalTokens = firstPositive(
                usage.path("total_tokens").asLong(-1),
                inputTokens + outputTokens);
        return new ChatUsage(inputTokens, outputTokens, totalTokens);
    }

    private long firstPositive(long first, long fallback) {
        if (first >= 0) {
            return first;
        }
        return Math.max(0, fallback);
    }

    private List<TravelPlanItem> parseGeneratedItems(TravelPlan plan, String content, List<Destination> candidates) throws java.io.IOException {
        JsonNode itineraryNode = objectMapper.readTree(extractJsonPayload(content));
        List<TravelPlanItem> items = new ArrayList<>();
        int seq = 1;
        if (itineraryNode.isArray()) {
            for (JsonNode node : itineraryNode) {
                if (isDayContainer(node)) {
                    int dayNumber = firstInt(node, 1, "dayNumber", "day", "day_number");
                    JsonNode dayItems = firstArray(node, "items", "activities", "stops", "schedule");
                    for (JsonNode itemNode : dayItems) {
                        items.add(parseItem(plan, itemNode, seq++, dayNumber, candidates));
                    }
                } else {
                    items.add(parseItem(plan, node, seq++, null, candidates));
                }
            }
        } else if (itineraryNode.isObject()) {
            JsonNode dayItems = firstArray(itineraryNode, "items", "days", "itinerary", "dailyPlans", "daily_itinerary", "schedule");
            for (JsonNode node : dayItems) {
                if (isDayContainer(node)) {
                    int dayNumber = firstInt(node, 1, "dayNumber", "day", "day_number");
                    for (JsonNode itemNode : firstArray(node, "items", "activities", "stops", "schedule")) {
                        items.add(parseItem(plan, itemNode, seq++, dayNumber, candidates));
                    }
                } else {
                    items.add(parseItem(plan, node, seq++, null, candidates));
                }
            }
        }
        return items;
    }

    private List<TravelPlanItem> applyVerifiedFoodPlaces(TravelPlan plan, List<TravelPlanItem> items) {
        Map<String, Integer> placeUseCounts = new LinkedHashMap<>();
        for (TravelPlanItem item : items) {
            if (!isFoodOrCafe(item)) {
                continue;
            }
            String style = normalizeFoodStyle(item.getPrimaryStyle());
            String counterKey = item.getDayNumber() + ":" + style;
            int ordinal = placeUseCounts.merge(counterKey, 1, Integer::sum) - 1;
            RealLocalPlaceResponse place = realPlaceService.pickFoodPlace(
                    plan.getRegion(),
                    style,
                    item.getDayNumber(),
                    ordinal,
                    item.getDestinationName());
            if (place == null) {
                continue;
            }
            item.setDestinationId(null);
            item.setDestinationName(place.name());
            item.setRegion(place.region());
            item.setPrimaryStyle(place.category());
            item.setNote(limitText(placeNote(place), 240));
            item.setDurationMinutes(normalizeDuration(item.getDurationMinutes()));
        }
        return items;
    }

    private boolean isOsakaKyotoCouplePreset(String regionLabel, int days, String travelerType, TravelPlanGenerateRequest request) {
        String joinedRegions = request.regions() == null ? "" : String.join(" ", request.regions());
        String text = String.join(" ",
                defaultText(regionLabel, ""),
                joinedRegions,
                defaultText(request.region(), ""),
                defaultText(request.memo(), ""),
                defaultText(request.mustVisit(), ""),
                defaultText(travelerType, "")).toLowerCase();
        boolean hasOsaka = text.contains("오사카") || text.contains("osaka");
        boolean hasKyoto = text.contains("교토") || text.contains("kyoto");
        boolean coupleTrip = text.contains("커플") || text.contains("부부") || text.contains("couple")
                || text.contains("osaka-kyoto-couple-3n4d");
        return days == 4 && hasOsaka && hasKyoto && coupleTrip;
    }

    private List<TravelPlanItem> osakaKyotoCoupleItems(TravelPlan plan, List<Destination> candidates) {
        List<TravelPlanItem> items = new ArrayList<>();
        int sequence = 1;
        for (FixedPlanSlot slot : OSAKA_KYOTO_COUPLE_SLOTS) {
            Destination destination = matchDestination(slot.destinationName(), candidates);
            TravelPlanItem item = new TravelPlanItem();
            item.setTravelPlanId(plan.getId());
            item.setDayNumber(slot.dayNumber());
            item.setSequenceNumber(sequence++);
            item.setTimeSlot(slot.timeSlot());
            item.setDestinationId(destination == null ? null : destination.getId());
            item.setDestinationName(destination == null ? slot.destinationName() : destination.getName());
            item.setRegion(destination == null ? slot.region() : destination.getRegion());
            item.setNote(limitText(slot.note(), 240));
            item.setPrimaryStyle(slot.primaryStyle());
            item.setDurationMinutes(slot.durationMinutes());
            items.add(item);
        }
        return items;
    }

    private String placeNote(RealLocalPlaceResponse place) {
        List<String> parts = new ArrayList<>();
        parts.add(defaultText(place.roadAddress(), defaultText(place.address(), "주소 미정")));
        if (!LocalTripText.normalize(place.recommendedMenu()).isBlank()) {
            parts.add("추천 메뉴: " + place.recommendedMenu());
        }
        if (!LocalTripText.normalize(place.phone()).isBlank()) {
            parts.add("전화: " + place.phone());
        }
        if (!LocalTripText.normalize(place.verificationNote()).isBlank()) {
            parts.add(place.verificationNote());
        }
        parts.add("출처: " + place.source());
        return String.join(" · ", parts);
    }

    private boolean isFoodOrCafe(TravelPlanItem item) {
        String style = LocalTripText.normalize(item.getPrimaryStyle()).toLowerCase();
        if (style.matches(".*(식당|식사|맛집|아침|점심|저녁|한식|분식|레스토랑|restaurant|meal|카페|커피|디저트|브런치|간식|베이커리|cafe|coffee|bakery|snack).*")) {
            return true;
        }
        String note = LocalTripText.normalize(item.getNote()).toLowerCase();
        return note.matches(".*(추천 메뉴|아침|점심|저녁|식사|커피|디저트|브런치|간식|menu|snack).*");
    }

    private String normalizeFoodStyle(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.matches(".*(카페|커피|디저트|브런치|간식|베이커리).*") ? "카페" : "식당";
    }

    private String extractJsonPayload(String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.contains("```json")) {
            normalized = normalized.substring(normalized.indexOf("```json") + 7);
            normalized = normalized.substring(0, normalized.lastIndexOf("```"));
        } else if (normalized.contains("```")) {
            normalized = normalized.substring(normalized.indexOf("```") + 3);
            normalized = normalized.substring(0, normalized.lastIndexOf("```"));
        }
        int arrayStart = normalized.indexOf('[');
        int arrayEnd = normalized.lastIndexOf(']');
        int objectStart = normalized.indexOf('{');
        int objectEnd = normalized.lastIndexOf('}');
        if (arrayStart >= 0 && arrayEnd > arrayStart && (objectStart < 0 || arrayStart < objectStart)) {
            return normalized.substring(arrayStart, arrayEnd + 1);
        }
        if (objectStart >= 0 && objectEnd > objectStart) {
            return normalized.substring(objectStart, objectEnd + 1);
        }
        return normalized;
    }

    private String codexModel() {
        String model = appProperties.codexModel();
        return model == null || model.isBlank() ? ChatCredentialService.DEFAULT_CODEX_MODEL : model.trim();
    }

    private String openAiChatModel() {
        String model = appProperties.openAiModel();
        return model == null || model.isBlank() ? "gpt-4.1-mini" : model.trim();
    }

    private HttpStatus openAiFailureStatus(int statusCode) {
        if (statusCode == 400 || statusCode == 401 || statusCode == 403 || statusCode == 429) {
            return HttpStatus.BAD_REQUEST;
        }
        return HttpStatus.BAD_GATEWAY;
    }

    private String summarizeOpenAiError(int statusCode, String body) {
        String normalized = body == null ? "" : body.replaceAll("sk-[A-Za-z0-9_-]+", "sk-***").replaceAll("\\s+", " ").trim();
        String lower = normalized.toLowerCase();
        if (statusCode == 401 || statusCode == 403) {
            return "기본 또는 저장된 OpenAI API 키의 권한을 확인해 주세요.";
        }
        if (statusCode == 429) {
            return "기본 또는 저장된 OpenAI API 키의 사용량 한도 또는 결제 상태를 확인해 주세요.";
        }
        if (lower.contains("model") || lower.contains("does not exist") || lower.contains("not found")) {
            return "OpenAI 모델 설정을 확인해 주세요. 현재 모델: " + openAiChatModel();
        }
        if (normalized.isBlank()) {
            return "HTTP " + statusCode;
        }
        return normalized.length() > 180 ? normalized.substring(0, 180) + "..." : normalized;
    }

    private String normalizeBaseUrl(String value) {
        String baseUrl = value == null || value.isBlank() ? "https://api.openai.com/v1" : value.trim();
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private boolean isDayContainer(JsonNode node) {
        return node != null
                && node.isObject()
                && (node.has("items") || node.has("activities") || node.has("stops") || node.has("schedule"));
    }

    private JsonNode firstArray(JsonNode node, String... fields) {
        if (node == null) {
            return objectMapper.createArrayNode();
        }
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (value.isArray()) {
                return value;
            }
        }
        return objectMapper.createArrayNode();
    }

    private String firstText(JsonNode node, String fallback, String... fields) {
        if (node == null) {
            return fallback;
        }
        for (String field : fields) {
            String value = LocalTripText.normalize(node.path(field).asText(""));
            if (!value.isBlank()) {
                return value;
            }
        }
        return fallback;
    }

    private int firstInt(JsonNode node, int fallback, String... fields) {
        if (node == null) {
            return fallback;
        }
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (value.canConvertToInt()) {
                return value.asInt();
            }
        }
        return fallback;
    }

    private TravelPlanItem parseItem(TravelPlan plan, JsonNode node, int sequence, Integer dayNumber, List<Destination> candidates) {
        String destinationName = firstText(node, "미정", "destinationName", "destination_name", "title", "name", "place", "activity");
        Destination destination = matchDestination(destinationName, candidates);
        String timeSlot = normalizeTimeSlot(firstText(node, "", "timeSlot", "time_slot", "time", "scheduleTime", "schedule_time"), sequence);
        String primaryStyle = firstText(node, "관광", "primaryStyle", "primary_style", "category", "type", "kind");
        TravelPlanItem item = new TravelPlanItem();
        item.setTravelPlanId(plan.getId());
        item.setDayNumber(dayNumber == null ? firstInt(node, 1, "dayNumber", "day", "day_number") : dayNumber);
        item.setSequenceNumber(sequence);
        item.setTimeSlot(timeSlot);
        item.setDestinationName(destination == null ? destinationName : destination.getName());
        item.setDestinationId(destination == null ? null : destination.getId());
        item.setRegion(destination == null ? plan.getRegion() : destination.getRegion());
        item.setNote(limitText(firstText(node, "", "note", "notes", "description", "summary", "reason"), 240));
        item.setPrimaryStyle(limitText(primaryStyle, 36));
        item.setDurationMinutes(normalizeDuration(firstInt(node, defaultDurationMinutes(item.getTimeSlot()), "durationMinutes", "duration_minutes")));
        return item;
    }

    private List<TravelPlanItem> fallbackItems(TravelPlan plan, List<Destination> candidates) {
        List<TravelPlanItem> items = new ArrayList<>();
        for (int day = 1; day <= plan.getDays(); day++) {
            Set<String> usedDestinationNames = new HashSet<>();
            for (int slotIndex = 0; slotIndex < FALLBACK_SLOTS.size(); slotIndex++) {
                FallbackSlot slot = FALLBACK_SLOTS.get(slotIndex);
                Destination destination = selectFallbackDestination(candidates, usedDestinationNames, slot, day, slotIndex);
                TravelPlanItem item = new TravelPlanItem();
                item.setTravelPlanId(plan.getId());
                item.setDayNumber(day);
                item.setSequenceNumber(((day - 1) * FALLBACK_SLOTS.size()) + slotIndex + 1);
                item.setTimeSlot(slot.timeSlot());
                item.setDestinationId(destination == null ? null : destination.getId());
                item.setDestinationName(fallbackDestinationName(plan, destination, slot));
                item.setRegion(destination == null ? plan.getRegion() : destination.getRegion());
                item.setNote(limitText(fallbackNote(slotIndex, destination, slot), 240));
                item.setPrimaryStyle(slot.primaryStyle());
                item.setDurationMinutes(slot.durationMinutes());
                items.add(item);
            }
        }
        return items;
    }

    private Destination selectFallbackDestination(
            List<Destination> candidates,
            Set<String> usedDestinationNames,
            FallbackSlot slot,
            int day,
            int slotIndex) {
        if (candidates.isEmpty() || isFallbackFoodOrCafe(slot.primaryStyle())) {
            return null;
        }
        List<Destination> preferred = candidates.stream()
                .filter(destination -> !isDestinationFoodOrCafe(destination))
                .filter(destination -> matchesFallbackSlot(destination, slot.primaryStyle()))
                .toList();
        List<Destination> fallback = preferred.isEmpty()
                ? candidates.stream().filter(destination -> !isDestinationFoodOrCafe(destination)).toList()
                : preferred;
        if (fallback.isEmpty()) {
            return null;
        }
        int start = Math.floorMod((day - 1) * FALLBACK_SLOTS.size() + slotIndex, fallback.size());
        for (int offset = 0; offset < fallback.size(); offset++) {
            Destination destination = fallback.get((start + offset) % fallback.size());
            String key = normalizePlaceName(destination.getName());
            if (usedDestinationNames.add(key)) {
                return destination;
            }
        }
        return fallback.get(start);
    }

    private boolean matchesFallbackSlot(Destination destination, String slotStyle) {
        String style = LocalTripText.normalize(slotStyle);
        String text = (defaultText(destination.getPrimaryStyle(), "") + " "
                + defaultText(destination.getCategory(), "") + " "
                + defaultText(destination.getStyleTags(), "")).toLowerCase();
        if (style.contains("야경")) {
            return text.matches(".*(야경|전망|타워|해변|공원|사진).*");
        }
        if (style.contains("산책")) {
            return text.matches(".*(산책|자연|공원|거리|마을|해변|호수|숲).*");
        }
        return text.matches(".*(관광|역사|사진|자연|공원|궁궐|사찰|신사|전망|마을|거리|유적|박물관).*");
    }

    private boolean isFallbackFoodOrCafe(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.matches(".*(식당|식사|맛집|아침|점심|저녁|카페|간식).*");
    }

    private boolean isDestinationFoodOrCafe(Destination destination) {
        String text = (defaultText(destination.getPrimaryStyle(), "") + " "
                + defaultText(destination.getCategory(), "") + " "
                + defaultText(destination.getStyleTags(), "") + " "
                + defaultText(destination.getName(), "")).toLowerCase();
        return text.matches(".*(식당|맛집|시장|카페|커피|디저트|브런치|간식|베이커리|먹자|food|cafe|coffee|market|snack).*");
    }

    private String normalizePlaceName(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").toLowerCase();
    }

    @Transactional
    public List<TravelPlanResponse> listPlans() {
        return listPlans("admin");
    }

    @Transactional
    public List<TravelPlanResponse> listPlans(String username) {
        schemaService.ensureSchema();
        return travelPlanRepository.findAllByUsernameOrderByCreatedAtDesc(username).stream()
                .map(p -> TravelPlanResponse.from(
                        p,
                        travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(p.getId()),
                        destinationService.findCandidates(List.of(p.getRegion().split("·")), LocalTripText.splitCsv(p.getStyles()))))
                .toList();
    }

    @Transactional
    public TravelPlanResponse getPlan(Long id) {
        return getPlan(id, "admin");
    }

    @Transactional
    public TravelPlanResponse getPlan(Long id, String username) {
        schemaService.ensureSchema();
        TravelPlan plan = travelPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Travel plan not found"));
        if (!username.equals(plan.getUsername())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Travel plan not found");
        }
        return TravelPlanResponse.from(
                plan,
                travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(id),
                destinationService.findCandidates(List.of(plan.getRegion().split("·")), LocalTripText.splitCsv(plan.getStyles())));
    }

    @Transactional
    public void deletePlan(Long id) {
        deletePlan(id, "admin");
    }

    @Transactional
    public void deletePlan(Long id, String username) {
        schemaService.ensureSchema();
        TravelPlan plan = travelPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Travel plan not found"));
        if (!username.equals(plan.getUsername())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Travel plan not found");
        }
        travelPlanItemRepository.deleteByTravelPlanId(id);
        travelPlanRepository.deleteById(id);
    }

    private List<String> normalizeRegions(TravelPlanGenerateRequest request) {
        List<String> regions = normalizeList(request.regions());
        String singleRegion = LocalTripText.normalize(request.region());
        if (!singleRegion.isBlank() && regions.stream().noneMatch(singleRegion::equalsIgnoreCase)) {
            List<String> merged = new ArrayList<>(regions);
            merged.add(singleRegion);
            return merged;
        }
        return regions;
    }

    private List<String> normalizeStyles(TravelPlanGenerateRequest request) {
        List<String> styles = normalizeList(request.styles());
        List<String> travelStyles = normalizeList(request.travelStyle());
        if (!travelStyles.isEmpty()) {
            styles = new ArrayList<>(styles);
            for (String ts : travelStyles) {
                if (styles.stream().noneMatch(ts::equalsIgnoreCase)) {
                    styles.add(ts);
                }
            }
        }
        String singleStyle = LocalTripText.normalize(request.style());
        if (!singleStyle.isBlank() && styles.stream().noneMatch(singleStyle::equalsIgnoreCase)) {
            List<String> merged = new ArrayList<>(styles);
            merged.add(singleStyle);
            return merged;
        }
        return styles;
    }

    private List<String> normalizeList(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .map(LocalTripText::normalize)
                .filter(v -> !v.isBlank())
                .distinct()
                .toList();
    }

    private String defaultText(String value, String fallback) {
        String normalized = LocalTripText.normalize(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private Destination matchDestination(String destinationName, List<Destination> candidates) {
        String normalizedName = LocalTripText.normalize(destinationName);
        if (normalizedName.isBlank()) {
            return null;
        }
        return candidates.stream()
                .filter(destination -> normalizedName.contains(destination.getName()) || destination.getName().contains(normalizedName))
                .findFirst()
                .orElse(null);
    }

    private String normalizeTimeSlot(String value, int sequence) {
        String normalized = LocalTripText.normalize(value).replace("–", "~").replace("-", "~");
        if (!normalized.isBlank()) {
            return limitText(normalized, 40);
        }
        return FALLBACK_SLOTS.get(Math.floorMod(sequence - 1, FALLBACK_SLOTS.size())).timeSlot();
    }

    private int normalizeDuration(int durationMinutes) {
        if (durationMinutes <= 0) {
            return 120;
        }
        return Math.min(240, Math.max(45, durationMinutes));
    }

    private int defaultDurationMinutes(String timeSlot) {
        String normalized = LocalTripText.normalize(timeSlot);
        if (normalized.matches(".*(아침|간식|카페).*")) {
            return 50;
        }
        if (normalized.contains("점심") || normalized.contains("저녁") || normalized.contains("식사")) {
            return 70;
        }
        return 90;
    }

    private String fallbackDestinationName(TravelPlan plan, Destination destination, FallbackSlot slot) {
        String style = LocalTripText.normalize(slot.primaryStyle());
        if (destination != null && !style.matches(".*(식당|식사|카페|간식).*")) {
            return destination.getName();
        }
        if (style.contains("아침")) {
            return plan.getRegion() + " 아침 식당";
        }
        if (style.contains("점심")) {
            return plan.getRegion() + " 점심 식당";
        }
        if (style.contains("저녁")) {
            return plan.getRegion() + " 저녁 식당";
        }
        if (style.contains("간식")) {
            return plan.getRegion() + " 간식 거리";
        }
        if (style.contains("카페")) {
            return plan.getRegion() + " 카페 휴식";
        }
        return destination == null ? plan.getRegion() + " 자유 여행" : destination.getName();
    }

    private String fallbackNote(int slotIndex, Destination destination, FallbackSlot slot) {
        String style = LocalTripText.normalize(slot.primaryStyle());
        if (destination == null) {
            if (style.contains("아침")) {
                return "숙소 또는 출발지 근처에서 아침 식사 시간을 먼저 확보하세요.";
            }
            if (style.contains("점심")) {
                return "오전 관광지 근처에서 점심 식사 시간을 확보하세요.";
            }
            if (style.contains("저녁")) {
                return "마지막 관광지 근처에서 저녁 식사를 하고 숙소 복귀 동선을 줄이세요.";
            }
            if (style.contains("간식")) {
                return "카페와 별도로 시장, 베이커리, 로컬 디저트 같은 짧은 간식 블록을 넣으세요.";
            }
            if (style.contains("카페")) {
                return "오후 이동 전후로 하루 1곳만 쉬어갈 수 있는 카페를 배치하세요.";
            }
            return "동선을 여유 있게 조정하며 주변 식사와 휴식 시간을 확보하세요.";
        }
        return switch (slotIndex) {
            case 0 -> "출발 전 아침 식사와 이동 준비 시간을 확보하세요.";
            case 1 -> destination.getDistrict() + " 핵심 관광지를 오전에 여유 있게 둘러보세요.";
            case 2 -> destination.getName() + " 근처에서 점심 식사와 짧은 휴식을 잡으세요.";
            case 3 -> destination.getDescription();
            case 4 -> "시장 또는 디저트 가게에서 짧은 간식 시간을 따로 잡으세요.";
            case 5 -> destination.getName() + " 이동 동선의 카페에서 하루 1번만 쉬어가세요.";
            default -> destination.getName() + " 근처에서 저녁 식사를 하고 숙소 복귀 시간을 남기세요.";
        };
    }

    private String limitText(String value, int maxLength) {
        String normalized = LocalTripText.normalize(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }

    private record FallbackSlot(String timeSlot, String primaryStyle, int durationMinutes) {
    }

    private record FixedPlanSlot(
            int dayNumber,
            String timeSlot,
            String destinationName,
            String region,
            String primaryStyle,
            int durationMinutes,
            String note) {
    }
}
