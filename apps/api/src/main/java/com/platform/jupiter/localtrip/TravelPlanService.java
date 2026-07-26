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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TravelPlanService {
    private static final Logger log = LoggerFactory.getLogger(TravelPlanService.class);
    private static final List<FallbackSlot> FALLBACK_SLOTS = List.of(
            new FallbackSlot("08:30-09:20", "아침 식당", 50),
            new FallbackSlot("09:50-11:20", "관광지", 90),
            new FallbackSlot("12:00-13:10", "점심 식당", 70),
            new FallbackSlot("13:50-15:10", "관광지", 80),
            new FallbackSlot("15:20-15:50", "간식", 30),
            new FallbackSlot("16:10-16:55", "카페", 45),
            new FallbackSlot("18:00-19:10", "저녁 식당", 70));
    private static final List<FixedPlanSlot> OSAKA_KYOTO_USJ_GUIDE_SLOTS = List.of(
            new FixedPlanSlot(1, "10:30-11:15", "간사이공항 도착·입국 정리", "오사카", "휴식", 45, "수하물 수령, 화장실, 교통권 구매까지 한 번에 처리합니다."),
            new FixedPlanSlot(1, "11:15-12:25", "간사이공항역에서 호텔까지 이동", "오사카", "이동", 70, "간사이공항역에서 Nankai 공항선으로 덴가차야역, Osaka Metro 사카이스지선으로 나가호리바시역까지 이동합니다."),
            new FixedPlanSlot(1, "12:25-12:45", "숙소 프런트 짐 맡기기", "오사카", "휴식", 20, "아크호텔 오사카 신사이바시에 캐리어를 맡기고 작은 가방만 챙깁니다."),
            new FixedPlanSlot(1, "12:55-13:45", "이치란 도톤보리점", "오사카", "점심 식당", 50, "첫 식사는 주문이 쉬운 라멘으로 빠르게 해결합니다. 추천 메뉴: 돈코츠 라멘, 반숙달걀."),
            new FixedPlanSlot(1, "13:45-14:20", "호텔 권역에서 오사카성 이동", "오사카", "이동", 35, "나가호리바시역에서 Osaka Metro 나가호리쓰루미료쿠치선으로 모리노미야역까지 이동합니다."),
            new FixedPlanSlot(1, "14:20-15:40", "오사카성 공원", "오사카", "관광지", 80, "입국일 오후라 천수각 입장보다 공원과 성곽 산책 중심으로 봅니다."),
            new FixedPlanSlot(1, "15:40-16:15", "오사카성에서 하루카스300 이동", "오사카", "이동", 35, "모리노미야역에서 타니마치6초메역 환승 후 덴노지역으로 이동합니다."),
            new FixedPlanSlot(1, "16:20-17:40", "하루카스300 전망대", "오사카", "관광지", 80, "해 질 무렵 오사카 도심과 베이 방향 전망을 봅니다."),
            new FixedPlanSlot(1, "17:40-18:00", "하루카스에서 신세카이 이동", "오사카", "이동", 20, "덴노지역에서 Osaka Metro 미도스지선으로 도부쓰엔마에역까지 이동 후 츠텐카쿠까지 걷습니다."),
            new FixedPlanSlot(1, "18:00-19:00", "신세카이·츠텐카쿠", "오사카", "관광지", 60, "레트로 간판과 츠텐카쿠 주변 야경을 둘러봅니다."),
            new FixedPlanSlot(1, "19:00-20:00", "쿠시카츠 다루마 신세카이 총본점", "오사카", "저녁 식당", 60, "오사카 대표 쿠시카츠로 입국일 저녁을 마무리합니다. 추천 메뉴: 쿠시카츠 세트, 도테야키."),
            new FixedPlanSlot(1, "20:00-20:20", "신세카이에서 도톤보리 이동", "오사카", "이동", 20, "도부쓰엔마에역에서 Osaka Metro 사카이스지선으로 닛폰바시역까지 이동합니다."),
            new FixedPlanSlot(1, "20:20-21:30", "도톤보리·호젠지요코초", "오사카", "관광지", 70, "글리코 사인, 도톤보리 강변, 호젠지요코초를 짧은 도보로 묶습니다."),

            new FixedPlanSlot(2, "06:55-07:25", "코메다커피 신사이바시점", "오사카", "아침 식당", 30, "교토 이동 전 호텔 근처에서 가볍게 시작합니다. 추천 메뉴: 모닝 토스트 세트, 커피."),
            new FixedPlanSlot(2, "07:35-09:05", "호텔에서 아라시야마 이동", "교토", "이동", 90, "나가호리바시역에서 사카이스지선, 한큐 교토선, 한큐 아라시야마선을 이어 탑니다."),
            new FixedPlanSlot(2, "09:05-10:20", "아라시야마 대나무숲·도게츠교", "교토", "관광지", 75, "대나무숲을 먼저 걷고 강변 도게츠교까지 이어 봅니다."),
            new FixedPlanSlot(2, "10:20-11:15", "아라시야마에서 금각사 이동", "교토", "이동", 55, "란덴 아라시야마본선, 란덴 기타노선, 교토 시버스 204 또는 205번으로 금각사미치까지 갑니다."),
            new FixedPlanSlot(2, "11:15-12:05", "금각사", "교토", "관광지", 50, "정원 동선이 정해져 있어 50분 안팎으로 보기 좋습니다."),
            new FixedPlanSlot(2, "12:05-12:55", "금각사에서 가와라마치 이동", "교토", "이동", 50, "금각사미치 정류장에서 교토 시버스 205번으로 시조카와라마치까지 내려갑니다."),
            new FixedPlanSlot(2, "13:00-14:00", "가츠쿠라 산조 본점", "교토", "점심 식당", 60, "교토에서 한국인 여행객에게 유명한 돈카츠 식당입니다. 추천 메뉴: 로스카츠 정식, 히레카츠 정식."),
            new FixedPlanSlot(2, "14:00-14:30", "가와라마치에서 청수사 이동", "교토", "이동", 30, "시조카와라마치 정류장에서 교토 시버스 207번으로 기요미즈미치 정류장까지 이동합니다."),
            new FixedPlanSlot(2, "14:30-15:45", "청수사", "교토", "관광지", 75, "교토 대표 사찰과 전망대를 보고 히가시야마 골목으로 내려옵니다."),
            new FixedPlanSlot(2, "15:45-16:35", "산넨자카·니넨자카", "교토", "관광지", 50, "청수사에서 내려오며 전통 골목, 기념품, 사진 포인트를 봅니다."),
            new FixedPlanSlot(2, "16:35-17:10", "% Arabica Kyoto Higashiyama", "교토", "카페", 35, "히가시야마 동선 중 짧게 쉬어가는 커피 휴식입니다. 추천 메뉴: 교토 라테, 아메리카노."),
            new FixedPlanSlot(2, "17:25-18:00", "야사카신사", "교토", "관광지", 35, "기온으로 넘어가기 전 무료로 짧게 들르기 좋은 신사입니다."),
            new FixedPlanSlot(2, "18:05-19:05", "Gion Duck Noodles", "교토", "저녁 식당", 60, "기온권에서 동선을 크게 벗어나지 않는 인기 라멘 후보입니다. 추천 메뉴: 오리 라멘, 츠케멘."),
            new FixedPlanSlot(2, "19:10-20:20", "하나미코지 & 기온거리 야경", "교토", "관광지", 70, "후시미이나리는 제외하고 밝고 사람 많은 기온 중심부 야경만 봅니다."),
            new FixedPlanSlot(2, "20:20-21:35", "교토 가와라마치에서 오사카 복귀", "오사카", "이동", 75, "한큐 교토선 특급으로 오사카우메다역, Osaka Metro 미도스지선으로 신사이바시역까지 복귀합니다."),

            new FixedPlanSlot(3, "07:20-07:50", "마츠야 나가호리바시점", "오사카", "아침 식당", 30, "USJ 입장 전 빠르게 먹는 아침입니다. 추천 메뉴: 규메시, 조식 정식."),
            new FixedPlanSlot(3, "07:55-08:45", "호텔에서 유니버설시티 이동", "오사카", "이동", 50, "나가호리바시역에서 돔마에치요자키역, 한신 도무마에역, 니시쿠조역, JR 유메사키선으로 유니버설시티역까지 갑니다."),
            new FixedPlanSlot(3, "09:00-12:20", "유니버설 스튜디오 재팬 오전", "오사카", "관광지", 200, "입장 직후 공식 앱에서 에어리어 입장 정리권과 대기시간을 확인합니다."),
            new FixedPlanSlot(3, "12:30-13:30", "키노피오 카페", "오사카", "점심 식당", 60, "슈퍼 닌텐도 월드 입장이 잡혔을 때 만족도가 높은 점심 후보입니다. 추천 메뉴: 마리오 버거, 오므라이스 메뉴."),
            new FixedPlanSlot(3, "13:45-17:20", "USJ 오후 어트랙션", "오사카", "관광지", 215, "해리포터, 미니언, 주라기 구역을 대기시간에 맞춰 순서 조정합니다."),
            new FixedPlanSlot(3, "17:20-17:55", "비버리힐즈 블랑제리", "오사카", "카페", 35, "오후 체력 회복을 위한 파크 내 카페 휴식입니다. 추천 메뉴: 케이크, 커피."),
            new FixedPlanSlot(3, "18:00-20:00", "USJ 굿즈·야간 분위기", "오사카", "쇼핑", 120, "마지막 어트랙션과 기념품 구매를 마무리합니다."),
            new FixedPlanSlot(3, "20:10-20:55", "TAKOPA 유니버설 시티워크 오사카", "오사카", "저녁 식당", 45, "퇴장 후 역 앞 시티워크에서 타코야키를 비교해 먹습니다. 추천 메뉴: 타코야키 비교 세트."),
            new FixedPlanSlot(3, "20:55-21:45", "유니버설시티에서 신사이바시 복귀", "오사카", "이동", 50, "JR 유메사키선으로 니시쿠조역, 한신 난바선으로 오사카난바역까지 돌아옵니다."),
            new FixedPlanSlot(3, "21:45-22:30", "신사이바시·도톤보리 쇼핑 야경", "오사카", "쇼핑", 45, "돈키호테, 드럭스토어, 도톤보리 야경을 짧게 정리합니다."),

            new FixedPlanSlot(4, "07:00-07:25", "체크아웃·짐 정리", "오사카", "휴식", 25, "여권, 항공권, 면세품, 보조배터리 위치를 확인합니다."),
            new FixedPlanSlot(4, "07:25-07:50", "조식 또는 공항 간단식", "오사카", "아침 식당", 25, "항공편 시간에 따라 호텔 근처 조식 또는 공항 도착 후 간단식으로 조정합니다."),
            new FixedPlanSlot(4, "08:00-09:25", "호텔에서 간사이공항 이동", "오사카", "이동", 85, "나가호리바시역에서 Osaka Metro 사카이스지선으로 덴가차야역, Nankai 공항선으로 간사이공항역까지 이동합니다."),
            new FixedPlanSlot(4, "09:25-11:00", "간사이공항 체크인·출국", "오사카", "휴식", 95, "체크인, 수하물 위탁, 보안검색, 출국심사를 여유 있게 처리합니다."));
    private static final String PLAN_PROVIDER = "openai";
    private static final String ADMIN_PLAN_KEY_USERNAME = "admin1";
    private static final int MAX_OUTPUT_TOKENS = 3000;
    private static final int CODEX_TIMEOUT_SECONDS = 180;

    private final TravelPlanRepository travelPlanRepository;
    private final TravelPlanItemRepository travelPlanItemRepository;
    private final LocalTripDestinationService destinationService;
    private final LocalTripRealPlaceService realPlaceService;
    private final TravelPlanItemQualityService itemQualityService;
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
            TravelPlanItemQualityService itemQualityService,
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
        this.itemQualityService = itemQualityService;
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
        boolean osakaKyotoUsjGuidePlan = isOsakaKyotoUsjGuidePlan(regionLabel, days, request);

        TravelPlan plan = new TravelPlan();
        plan.setUsername(username);
        plan.setTitle(osakaKyotoUsjGuidePlan ? "오사카·교토·USJ 3박 4일" : regionLabel + " " + days + "일 LocalTrip AI 일정");
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
        plan.setStartDate(limitText(defaultText(request.startDate(), ""), 20));
        plan.setEstimatedBudget(estimateBudget(days, travelerCount, request.budgetLevel(), request.transportType()));
        plan.setSummary(osakaKyotoUsjGuidePlan
                ? "간사이공항 입국 후 아크호텔 오사카 신사이바시를 거점으로 오사카 야경, 교토 풀코스, USJ 하루, 간사이공항 출국까지 묶은 3박 4일 일정입니다. 후시미이나리는 밤 이동 부담으로 제외했습니다."
                : regionLabel + "의 " + stylesLabel + " 취향을 반영한 " + travelerType + "용 "
                        + pace + " 속도 추천 일정입니다.");
        TravelPlan savedPlan = travelPlanRepository.save(plan);
        boolean useLocalDestinationData = request.destinationIds() != null && !request.destinationIds().isEmpty();
        List<Destination> destinations = useLocalDestinationData
                ? destinationService.findCandidatesForPlan(request.destinationIds(), regions, styles)
                : List.of();

        List<TravelPlanItem> generatedItems = osakaKyotoUsjGuidePlan
                ? osakaKyotoUsjGuideItems(savedPlan, destinations)
                : generateItineraryWithLocalGpt(savedPlan, request, username, destinations);
        List<TravelPlanItem> items = itemQualityService.normalize(
                savedPlan,
                generatedItems,
                destinations,
                !osakaKyotoUsjGuidePlan && useLocalDestinationData);
        travelPlanItemRepository.saveAll(items);

        return TravelPlanResponse.from(savedPlan, travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(savedPlan.getId()), destinations);
    }

    private List<TravelPlanItem> generateItineraryWithLocalGpt(TravelPlan plan, TravelPlanGenerateRequest request, String username, List<Destination> candidates) {
        String prompt = buildPrompt(plan, request, candidates);
        Optional<String> apiKey = resolveTravelPlanOpenAiApiKey(username);
        if (travelPlanCodexCliEnabled()) {
            try {
                List<TravelPlanItem> codexItems = generateItineraryWithCodexCli(plan, prompt, candidates, apiKey.orElse(""));
                if (!codexItems.isEmpty()) {
                    return codexItems;
                }
            } catch (ResponseStatusException codexException) {
                if (apiKey.isEmpty()) {
                    throw codexException;
                }
                log.warn("Travel plan Codex CLI generation failed; falling back to OpenAI API. status={}",
                        codexException.getStatusCode());
            }
        }
        String openAiApiKey = apiKey.orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "여행 계획 생성용 기본 OpenAI API 키가 필요합니다. APP_OPENAI_API_KEY 또는 OPENAI_API_KEY를 설정해 주세요."));
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
                    .header("Authorization", "Bearer " + openAiApiKey)
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
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "여행 일정 API 응답 JSON을 해석하지 못했습니다. 다시 생성해 주세요.", parseException);
            }
            if (items.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "여행 일정 API 응답에 일정 항목이 없습니다. 다시 생성해 주세요.");
            }
            return items;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI API 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OpenAI API 요청이 중단되었습니다. 다시 시도해 주세요.", e);
        }
    }

    private List<TravelPlanItem> generateItineraryWithCodexCli(TravelPlan plan, String prompt, List<Destination> candidates, String apiKey) {
        try {
            Path outputPath = Files.createTempFile("localtrip-codex-", ".json");
            ProcessBuilder builder = new ProcessBuilder(
                    codexCliPath(),
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
            if (apiKey != null && !apiKey.isBlank()) {
                environment.put("OPENAI_API_KEY", apiKey);
            }
            environment.put("CODEX_MODEL", codexModel());
            Process process = builder.start();
            process.getOutputStream().close();
            boolean completed = process.waitFor(CODEX_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                Files.deleteIfExists(outputPath);
                throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT, "Codex 여행 코스 생성 시간이 초과되었습니다. 다시 시도해 주세요.");
            }
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                Files.deleteIfExists(outputPath);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, codexCliFailureMessage(output));
            }
            String lastMessage = Files.exists(outputPath)
                    ? Files.readString(outputPath, StandardCharsets.UTF_8)
                    : "";
            Files.deleteIfExists(outputPath);
            return parseGeneratedItems(plan, lastMessage.isBlank() ? output : lastMessage, candidates);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Codex 여행 코스 생성 응답을 처리하지 못했습니다. 다시 생성해 주세요.", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Codex 여행 코스 생성이 중단되었습니다. 다시 시도해 주세요.", e);
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Codex CLI 여행 코스 생성에 실패했습니다. 서버 Codex 인증 또는 네트워크 상태를 확인해 주세요.", e);
        }
    }

    private String codexCliFailureMessage(String output) {
        String normalized = defaultText(output, "").toLowerCase();
        if (normalized.contains("token") && (normalized.contains("expired") || normalized.contains("refresh"))) {
            return "Codex 로그인 인증이 만료되어 여행 코스를 생성하지 못했습니다. 서버의 Codex 인증을 다시 로그인하거나 APP_OPENAI_API_KEY를 설정해 주세요.";
        }
        if (normalized.contains("unauthorized") || normalized.contains("401")) {
            return "Codex 인증이 거부되어 여행 코스를 생성하지 못했습니다. 서버의 Codex 로그인 상태를 확인해 주세요.";
        }
        return "Codex CLI 여행 코스 생성에 실패했습니다. 서버 Codex 인증 또는 네트워크 상태를 확인해 주세요.";
    }

    private Optional<String> resolveTravelPlanOpenAiApiKey(String username) {
        return resolveDefaultOpenAiApiKey()
                .or(() -> chatCredentialService.resolveOpenAiApiKey(username))
                .or(() -> ADMIN_PLAN_KEY_USERNAME.equals(username)
                        ? Optional.empty()
                        : chatCredentialService.resolveOpenAiApiKey(ADMIN_PLAN_KEY_USERNAME));
    }

    private boolean travelPlanCodexCliEnabled() {
        return Boolean.TRUE.equals(appProperties.enableTravelPlanCodexCliMode())
                || Boolean.TRUE.equals(appProperties.enableCodexCliMode());
    }

    private Optional<String> resolveDefaultOpenAiApiKey() {
        String apiKey = appProperties.openAiApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(apiKey.trim()).filter(value -> !value.isBlank());
    }

    private String buildPrompt(TravelPlan plan, TravelPlanGenerateRequest request, List<Destination> candidates) {
        String destinationContext = destinationCandidateContext(candidates);
        String dailyRouteContext = dailyRouteContext(request);
        String candidateInstruction = destinationContext.isBlank()
                ? "내부 기본 여행지 데이터는 사용하지 말고, 사용자가 입력한 지역·날짜·메모만 기준으로 실제 장소를 직접 구성해."
                : "아래 관광지/장소 후보는 사용자가 명시적으로 선택한 후보이므로 우선 반영해.";
        String candidateBlock = destinationContext.isBlank()
                ? "(명시 선택 후보 없음)"
                : "명시 선택 후보:\n" + destinationContext;
        return String.format(
            """
            엑셀 일정표 수준의 한국 또는 일본 여행 일정을 JSON 배열로 생성해줘.
            - 지역: %s
            - 시작일: %s
            - 기간: %d일
            - 동행: %s
            - 선호: %s
            - 속도: %s
            - 이동수단: %s
            - 예산: %s
            - 식사 취향: %s
            - 휴식 기준: %s
            - 하루 운영 시간: %s ~ %s
            - 꼭 반영할 것: %s
            - 피하고 싶은 것: %s
            - 일자별 출발/도착 조건:
            %s
            - 메모: %s
            - 후보 데이터 사용 방식: %s
            %s

            품질 기준:
            각 날짜는 현실적인 6~8개 핵심 블록으로 구성해. 공항, 숙소, 도시 간 이동처럼 일정에 영향이 큰 이동은 별도 이동 블록으로 넣어.
            식사는 아침/점심/저녁 중 일정상 필요한 만큼만 넣고, 식당·카페·간식은 이름이 확인 가능한 실제 영업 장소명만 써.
            식사와 카페/간식을 제외한 나머지는 관광지, 산책, 전망, 쇼핑 같은 실제 방문지로 채워. 같은 날 주요 관광지는 2~4곳을 넘기지 마.
            여러 날짜가 있는 여행에서는 식당/카페/간식/이동을 제외한 방문지를 날짜가 달라도 반복하지 마. 후보가 부족할 때만 예외로 둬.
            장소 사이에는 대중교통/도보 이동과 대기 시간을 합쳐 최소 20~40분 완충을 둬. 서로 먼 구역을 같은 날 여러 번 왕복하지 마.
            각 날짜의 첫 블록은 해당 날짜 출발지와 출발 시간 이후로 시작하고, 마지막 블록은 해당 날짜 도착지와 도착 시간 전에 끝나게 해.
            시작일이 있으면 날짜 흐름을 반영하고, 날짜별 요약이 자연스럽게 보이도록 장소명을 배치해.
            timeSlot은 09:30-10:50 같은 시간 범위로 쓰고, 같은 날 시간이 겹치면 안 돼.
            note에는 엑셀의 이동루트/교통권/비용/메모가 보이게 '이동: ... / 결제: ... / 비용: ... / 메모: ...' 형식으로 160자 이하로 써. 식당/카페/간식은 추천 메뉴도 포함해.
            destinationName은 선택한 국가와 지역에 맞는 실제 장소명으로 써. '로컬 식당', '카페 추천', '관광지 후보' 같은 일반명은 금지야.
            durationMinutes는 해당 블록의 권장 체류 시간을 분 단위 숫자로 써.
            primaryStyle은 이동, 휴식, 아침 식당, 점심 식당, 저녁 식당, 카페, 간식, 관광지, 산책, 쇼핑 중 가장 가까운 값을 써.
            API 키, 토큰, 서버 주소, 내부 설정 같은 민감정보는 절대 포함하지 마.
            형식: [{"dayNumber": 1, "timeSlot": "09:30-10:50", "destinationName": "장소", "note": "설명", "primaryStyle": "관광지", "durationMinutes": 80}, ...]
            """,
            plan.getRegion(),
            defaultText(request.startDate(), "미정"),
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
            candidateInstruction,
            candidateBlock
        );
    }

    private String destinationCandidateContext(List<Destination> candidates) {
        return candidates.stream()
                .filter(destination -> !LocalTripDestinationQuality.isFoodOrCafeDestination(destination))
                .limit(40)
                .map(destination -> String.format(
                        "- %s | %s %s | %s/%s | 주소=%s | 체류=%d분 | 태그=%s",
                        destination.getName(),
                        destination.getRegion(),
                        destination.getDistrict(),
                        defaultText(destination.getCategory(), "관광지"),
                        defaultText(destination.getPrimaryStyle(), "관광지"),
                        defaultText(destination.getAddress(), "주소 미정"),
                        destination.getRecommendedMinutes() == null ? 90 : destination.getRecommendedMinutes(),
                        defaultText(destination.getStyleTags(), "")))
                .collect(java.util.stream.Collectors.joining("\n"));
    }

    private String foodPlaceCandidateContext(TravelPlan plan, TravelPlanGenerateRequest request) {
        String anchor = String.join(" ",
                defaultText(request.startPlace(), ""),
                defaultText(request.endPlace(), ""),
                defaultText(request.mustVisit(), ""),
                defaultText(request.memo(), ""));
        List<RealLocalPlaceResponse> restaurants = realPlaceService.suggestFoodPlaces(plan.getRegion(), "식당", anchor, 12);
        List<RealLocalPlaceResponse> cafes = realPlaceService.suggestFoodPlaces(plan.getRegion(), "카페", anchor, 8);
        List<String> rows = new ArrayList<>();
        restaurants.stream()
                .limit(12)
                .map(place -> foodPlaceCandidateLine("식당", place))
                .forEach(rows::add);
        cafes.stream()
                .limit(8)
                .map(place -> foodPlaceCandidateLine("카페", place))
                .forEach(rows::add);
        return String.join("\n", rows);
    }

    private String foodPlaceCandidateLine(String slotType, RealLocalPlaceResponse place) {
        return String.format(
                "- %s | %s | %s | 주소=%s | 메뉴=%s",
                slotType,
                place.name(),
                defaultText(place.region(), "지역 미정"),
                defaultText(place.roadAddress(), defaultText(place.address(), "주소 미정")),
                defaultText(place.recommendedMenu(), "대표 메뉴 확인 필요"));
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
                    .filter(chunk -> isLocalTripRagDocument(chunk.documentId()))
                    .limit(4)
                    .map(chunk -> "- " + limitText(chunk.text(), 360))
                    .collect(java.util.stream.Collectors.joining("\n"));
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean isLocalTripRagDocument(String documentId) {
        String normalized = defaultText(documentId, "").toLowerCase();
        return normalized.contains("localtrip")
                || normalized.contains("travel")
                || normalized.contains("trip")
                || normalized.contains("여행")
                || normalized.contains("관광");
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

    private boolean isOsakaKyotoUsjGuidePlan(String regionLabel, int days, TravelPlanGenerateRequest request) {
        String joinedRegions = request.regions() == null ? "" : String.join(" ", request.regions());
        String text = String.join(" ",
                defaultText(regionLabel, ""),
                joinedRegions,
                defaultText(request.region(), ""),
                defaultText(request.memo(), ""),
                defaultText(request.mustVisit(), ""),
                defaultText(request.startPlace(), ""),
                defaultText(request.endPlace(), "")).toLowerCase();
        boolean hasOsaka = text.contains("오사카") || text.contains("osaka");
        boolean hasKyoto = text.contains("교토") || text.contains("kyoto");
        boolean hasUsj = text.contains("유니버설") || text.contains("usj") || text.contains("universal studios japan");
        return days == 4 && hasOsaka && hasKyoto && hasUsj;
    }

    private List<TravelPlanItem> osakaKyotoUsjGuideItems(TravelPlan plan, List<Destination> candidates) {
        List<TravelPlanItem> items = new ArrayList<>();
        int sequence = 1;
        for (FixedPlanSlot slot : OSAKA_KYOTO_USJ_GUIDE_SLOTS) {
            Destination destination = matchDestination(slot.destinationName(), candidates);
            TravelPlanItem item = new TravelPlanItem();
            item.setTravelPlanId(plan.getId());
            item.setDayNumber(slot.dayNumber());
            item.setSequenceNumber(sequence++);
            item.setTimeSlot(slot.timeSlot());
            item.setDestinationId(destination == null ? null : destination.getId());
            item.setDestinationName(slot.destinationName());
            item.setRegion(destination == null ? slot.region() : destination.getRegion());
            item.setNote(limitText(slot.note(), 240));
            item.setPrimaryStyle(slot.primaryStyle());
            item.setDurationMinutes(slot.durationMinutes());
            items.add(item);
        }
        return items;
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
        return model == null || model.isBlank() ? openAiChatModel() : model.trim();
    }

    private String codexCliPath() {
        String path = appProperties.codexCliPath();
        return path == null || path.isBlank() ? "codex" : path.trim();
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
        Set<String> usedDestinationNames = new HashSet<>();
        for (int day = 1; day <= plan.getDays(); day++) {
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
                .filter(destination -> !LocalTripDestinationQuality.isFoodOrCafeDestination(destination))
                .filter(destination -> LocalTripDestinationQuality.matchesVisitSlot(destination, slot.primaryStyle()))
                .toList();
        List<Destination> fallback = preferred.isEmpty()
                ? candidates.stream().filter(destination -> !LocalTripDestinationQuality.isFoodOrCafeDestination(destination)).toList()
                : preferred;
        if (fallback.isEmpty()) {
            return null;
        }
        int start = Math.floorMod((day - 1) * FALLBACK_SLOTS.size() + slotIndex, fallback.size());
        for (int offset = 0; offset < fallback.size(); offset++) {
            Destination destination = fallback.get((start + offset) % fallback.size());
            String key = LocalTripDestinationQuality.normalizePlaceName(destination.getName());
            if (usedDestinationNames.add(key)) {
                return destination;
            }
        }
        return fallback.get(start);
    }

    private boolean isFallbackFoodOrCafe(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.matches(".*(식당|식사|맛집|아침|점심|저녁|카페|간식).*");
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
