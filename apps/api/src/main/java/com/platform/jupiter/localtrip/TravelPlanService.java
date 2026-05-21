package com.platform.jupiter.localtrip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.chat.ChatUsage;
import com.platform.jupiter.chat.ChatUsageService;
import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.rag.RagQueryRequest;
import com.platform.jupiter.rag.RagService;
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
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TravelPlanService {
    private static final List<FallbackSlot> FALLBACK_SLOTS = List.of(
            new FallbackSlot("09:30-10:40", "관광지", 70),
            new FallbackSlot("11:00-12:00", "관광지", 60),
            new FallbackSlot("12:10-13:20", "식당", 70),
            new FallbackSlot("14:00-15:20", "관광지", 80),
            new FallbackSlot("15:40-16:30", "카페", 50),
            new FallbackSlot("17:00-18:00", "산책", 60),
            new FallbackSlot("18:20-19:30", "식당", 70),
            new FallbackSlot("20:00-20:50", "야경", 50));
    private static final String PLAN_PROVIDER = "openai";
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

        TravelPlan plan = new TravelPlan();
        plan.setUsername(username);
        plan.setTitle(regionLabel + " " + days + "일 LocalTrip AI 일정");
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
        plan.setDepartureTime(limitText(defaultText(request.departureTime(), ""), 20));
        plan.setArrivalTime(limitText(defaultText(request.arrivalTime(), ""), 20));
        plan.setEstimatedBudget("");
        plan.setSummary(regionLabel + "의 " + stylesLabel + " 취향을 반영한 " + travelerType + "용 "
                + pace + " 속도 추천 일정입니다.");
        TravelPlan savedPlan = travelPlanRepository.save(plan);
        List<Destination> destinations = destinationService.findCandidatesForPlan(request.destinationIds(), regions, styles);

        List<TravelPlanItem> items = applyVerifiedFoodPlaces(savedPlan, generateItineraryWithLocalGpt(savedPlan, request, username, destinations));
        travelPlanItemRepository.saveAll(items);

        return TravelPlanResponse.from(savedPlan, travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(savedPlan.getId()), destinations);
    }

    private List<TravelPlanItem> generateItineraryWithLocalGpt(TravelPlan plan, TravelPlanGenerateRequest request, String username, List<Destination> candidates) {
        String prompt = buildPrompt(plan, request, candidates);
        if (Boolean.TRUE.equals(appProperties.enableCodexCliMode())) {
            List<TravelPlanItem> codexItems = generateItineraryWithCodexCli(plan, prompt, candidates);
            if (!codexItems.isEmpty()) {
                return codexItems;
            }
        }
        String apiKey = chatCredentialService.resolveOpenAiApiKey(username).orElse("");
        if (apiKey.isBlank()) {
            return fallbackItems(plan, candidates);
        }
        try {
            String model = codexModel();
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
                return fallbackItems(plan, candidates);
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

            List<TravelPlanItem> items = parseGeneratedItems(plan, content, candidates);
            return items.isEmpty() ? fallbackItems(plan, candidates) : items;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            return fallbackItems(plan, candidates);
        }
    }

    private List<TravelPlanItem> generateItineraryWithCodexCli(TravelPlan plan, String prompt, List<Destination> candidates) {
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
            "- 전체 출발지: %s / 주소: %s / 출발 시간: %s\n" +
            "- 최종 목적지: %s / 주소: %s / 도착 시간: %s\n" +
            "- 일자별 출발/도착 조건:\n%s\n" +
            "- 메모: %s\n" +
            "- 우선 사용할 장소 후보: %s\n\n" +
            "RAG 검색 문맥:\n%s\n\n" +
            "각 날짜는 아침/오전 관광, 점심 식당, 오후 관광, 카페/휴식, 저녁 식당, 야경/산책 중 필요한 6~8개 블록으로 구성해.\n" +
            "각 날짜의 첫 블록은 해당 날짜 출발지와 출발 시간 이후로 시작하고, 마지막 블록은 해당 날짜 도착지와 도착 시간 전에 끝나게 해.\n" +
            "RAG 문맥이 지역, 동행, 취향과 맞으면 우선 반영하고, 맞지 않는 문맥은 억지로 쓰지 마.\n" +
            "timeSlot은 09:30-10:50 같은 시간 범위로 쓰고, 같은 날 시간이 겹치면 안 돼.\n" +
            "점심 식당과 카페/휴식은 매일 반드시 포함하고, 이름이 확인 가능한 실제 영업 장소명만 써. '로컬 식당', '카페 추천' 같은 일반명은 금지야.\n" +
            "각 블록 note에는 이전 장소에서 출발하는 시간, 이번 장소 도착 시간, 이동 팁을 포함해. 식당/카페는 추천 메뉴도 함께 써.\n" +
            "destinationName은 선택한 국가와 지역에 맞는 실제 장소명으로 쓰고 note는 추천 이유, 이동 팁, 체류 포인트 또는 추천 메뉴를 포함해 120자 이하로 구체적으로 써.\n" +
            "durationMinutes는 해당 블록의 권장 체류 시간을 분 단위 숫자로 써.\n" +
            "primaryStyle은 관광지, 식당, 카페, 야경, 산책, 이동 중 가장 가까운 값을 써.\n" +
            "API 키, 토큰, 서버 주소, 내부 설정 같은 민감정보는 절대 포함하지 마.\n" +
            "형식: [{\"dayNumber\": 1, \"timeSlot\": \"09:30-10:50\", \"destinationName\": \"장소\", \"note\": \"설명\", \"primaryStyle\": \"관광지\", \"durationMinutes\": 80}, ...]",
            plan.getRegion(),
            plan.getDays(),
            plan.getTravelerType(),
            plan.getStyles(),
            plan.getPace(),
            defaultText(request.transportType(), "대중교통"),
            defaultText(request.budgetLevel(), "보통"),
            defaultText(request.startPlace(), "미정"),
            defaultText(request.startAddress(), "미정"),
            defaultText(request.departureTime(), "미정"),
            defaultText(request.endPlace(), "미정"),
            defaultText(request.endAddress(), "미정"),
            defaultText(request.arrivalTime(), "미정"),
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
                        defaultText(route.departureTime(), defaultText(request.departureTime(), "미정")),
                        defaultText(route.endPlace(), "미정"),
                        defaultText(route.endAddress(), "미정"),
                        defaultText(route.arrivalTime(), defaultText(request.arrivalTime(), "미정"))))
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
        if (style.matches(".*(식당|맛집|점심|저녁|한식|분식|레스토랑|restaurant|meal|카페|커피|디저트|브런치|cafe|coffee|bakery).*")) {
            return true;
        }
        String note = LocalTripText.normalize(item.getNote()).toLowerCase();
        return note.matches(".*(추천 메뉴|점심|저녁|식사|커피|디저트|브런치|menu).*");
    }

    private String normalizeFoodStyle(String primaryStyle) {
        String normalized = LocalTripText.normalize(primaryStyle);
        return normalized.contains("카페") || normalized.contains("디저트") || normalized.contains("브런치") ? "카페" : "식당";
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
        return normalized.contains("식당") || normalized.contains("맛집") || normalized.contains("카페");
    }

    private boolean isDestinationFoodOrCafe(Destination destination) {
        String text = (defaultText(destination.getPrimaryStyle(), "") + " "
                + defaultText(destination.getCategory(), "") + " "
                + defaultText(destination.getStyleTags(), "") + " "
                + defaultText(destination.getName(), "")).toLowerCase();
        return text.matches(".*(식당|맛집|시장|카페|커피|디저트|브런치|먹자|food|cafe|coffee|market).*");
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
        if (normalized.contains("점심") || normalized.contains("휴식")) {
            return 90;
        }
        if (normalized.contains("저녁")) {
            return 120;
        }
        return 140;
    }

    private String fallbackDestinationName(TravelPlan plan, Destination destination, FallbackSlot slot) {
        if (destination != null && !slot.primaryStyle().matches("식당|카페")) {
            return destination.getName();
        }
        if ("식당".equals(slot.primaryStyle())) {
            return plan.getRegion() + " 로컬 식당";
        }
        if ("카페".equals(slot.primaryStyle())) {
            return plan.getRegion() + " 카페 휴식";
        }
        return destination == null ? plan.getRegion() + " 자유 여행" : destination.getName();
    }

    private String fallbackNote(int slotIndex, Destination destination, FallbackSlot slot) {
        if (destination == null) {
            if ("식당".equals(slot.primaryStyle())) {
                return "방문 동선 근처에서 지역 대표 메뉴로 식사 시간을 확보하세요.";
            }
            if ("카페".equals(slot.primaryStyle())) {
                return "오후 이동 전후로 쉬어갈 수 있는 카페를 배치하세요.";
            }
            return "동선을 여유 있게 조정하며 주변 식사와 휴식 시간을 확보하세요.";
        }
        return switch (slotIndex) {
            case 0 -> destination.getDistrict() + " 도착 후 혼잡 전 핵심 포인트부터 둘러보세요.";
            case 1 -> destination.getHeadline();
            case 2 -> destination.getName() + " 근처에서 점심 식사와 짧은 휴식을 잡으세요.";
            case 3 -> destination.getDescription();
            case 4 -> destination.getName() + " 이동 동선의 카페에서 쉬어가세요.";
            case 5 -> destination.getName() + " 주변을 가볍게 걸으며 다음 장소로 이동하세요.";
            case 6 -> destination.getName() + " 근처 저녁 식사 후보를 잡고 대기 시간을 줄이세요.";
            default -> destination.getName() + " 주변 야경이나 산책 동선으로 하루를 마무리하세요.";
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
}
