package com.platform.jupiter.localtrip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.chat.ChatUsage;
import com.platform.jupiter.chat.ChatUsageService;
import com.platform.jupiter.config.AppProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TravelPlanService {
    private static final List<String> TIME_SLOTS = List.of("09~10", "10~11", "11~12", "12~13", "13~14", "14~15", "15~16", "16~17", "18~19");
    private static final String PLAN_PROVIDER = "openai";
    private static final String CODEX_CLI_PATH = "/opt/jupiter-cli/bin/codex";
    private static final int MAX_OUTPUT_TOKENS = 3000;
    private static final int CODEX_TIMEOUT_SECONDS = 180;

    private final TravelPlanRepository travelPlanRepository;
    private final TravelPlanItemRepository travelPlanItemRepository;
    private final LocalTripDestinationService destinationService;
    private final LocalTripSchemaService schemaService;
    private final ChatCredentialService chatCredentialService;
    private final ChatUsageService chatUsageService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public TravelPlanService(
            TravelPlanRepository travelPlanRepository,
            TravelPlanItemRepository travelPlanItemRepository,
            LocalTripDestinationService destinationService,
            LocalTripSchemaService schemaService,
            ChatCredentialService chatCredentialService,
            ChatUsageService chatUsageService,
            AppProperties appProperties,
            ObjectMapper objectMapper) {
        this.travelPlanRepository = travelPlanRepository;
        this.travelPlanItemRepository = travelPlanItemRepository;
        this.destinationService = destinationService;
        this.schemaService = schemaService;
        this.chatCredentialService = chatCredentialService;
        this.chatUsageService = chatUsageService;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
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
        plan.setTitle(regionLabel + " " + days + "일 LocalTrip AI 일정");
        plan.setRegion(regionLabel);
        plan.setStyles(stylesLabel);
        plan.setDays(days);
        plan.setTravelerCount(travelerCount);
        plan.setTravelerType(travelerType);
        plan.setPace(pace);
        plan.setSummary(regionLabel + "의 " + stylesLabel + " 취향을 반영한 " + travelerType + "용 "
                + pace + " 속도 추천 일정입니다.");
        TravelPlan savedPlan = travelPlanRepository.save(plan);

        List<TravelPlanItem> items = generateItineraryWithLocalGpt(savedPlan, request, username);
        travelPlanItemRepository.saveAll(items);

        List<Destination> destinations = destinationService.findCandidates(regions, styles);
        return TravelPlanResponse.from(savedPlan, travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(savedPlan.getId()), destinations);
    }

    private List<TravelPlanItem> generateItineraryWithLocalGpt(TravelPlan plan, TravelPlanGenerateRequest request, String username) {
        String prompt = buildPrompt(plan, request);
        if (Boolean.TRUE.equals(appProperties.enableCodexCliMode())) {
            List<TravelPlanItem> codexItems = generateItineraryWithCodexCli(plan, prompt);
            if (!codexItems.isEmpty()) {
                return codexItems;
            }
        }
        String apiKey = chatCredentialService.resolveOpenAiApiKey(username).orElse("");
        if (apiKey.isBlank()) {
            return fallbackItems(plan);
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
                    Map.of("role", "system", "content", "너는 한국 전문 여행 가이드 AI다. 반드시 요청받은 JSON 형식으로만 답변해라."),
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
                return fallbackItems(plan);
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

            List<TravelPlanItem> items = parseGeneratedItems(plan, content);
            return items.isEmpty() ? fallbackItems(plan) : items;

        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            return fallbackItems(plan);
        }
    }

    private List<TravelPlanItem> generateItineraryWithCodexCli(TravelPlan plan, String prompt) {
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
            return parseGeneratedItems(plan, lastMessage.isBlank() ? output : lastMessage);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String buildPrompt(TravelPlan plan, TravelPlanGenerateRequest request) {
        String candidateNames = destinationService.findCandidates(
                        List.of(plan.getRegion().split("·")),
                        LocalTripText.splitCsv(plan.getStyles()))
                .stream()
                .limit(16)
                .map(destination -> destination.getName() + "(" + destination.getRegion() + "/" + destination.getPrimaryStyle() + ")")
                .collect(java.util.stream.Collectors.joining(", "));
        return String.format(
            "한국 여행 일정을 JSON 배열로 생성해줘.\n" +
            "- 지역: %s\n" +
            "- 기간: %d일\n" +
            "- 동행: %s\n" +
            "- 선호: %s\n" +
            "- 속도: %s\n" +
            "- 이동수단: %s\n" +
            "- 예산: %s\n" +
            "- 메모: %s\n" +
            "- 우선 사용할 장소 후보: %s\n\n" +
            "각 날짜마다 시간대별 세부 일정을 만들어줘. timeSlot은 반드시 09~10, 10~11, 11~12, 12~13, 13~14, 14~15, 15~16, 16~17, 18~19 중 하나로만 써.\n" +
            "하루에 최소 6개 이상 만들고, 12~13은 점심/휴식, 18~19는 저녁/야경/마무리 성격으로 배치해.\n" +
            "destinationName은 실제 한국 장소명으로 쓰고 note는 이동 팁, 체류 포인트, 주의사항을 포함해 70자 이하로 구체적으로 써.\n" +
            "API 키, 토큰, 서버 주소, 내부 설정 같은 민감정보는 절대 포함하지 마.\n" +
            "형식: [{\"dayNumber\": 1, \"timeSlot\": \"09~10\", \"destinationName\": \"장소\", \"note\": \"설명\", \"primaryStyle\": \"테마\"}, ...]",
            plan.getRegion(),
            plan.getDays(),
            plan.getTravelerType(),
            plan.getStyles(),
            plan.getPace(),
            defaultText(request.transportType(), "대중교통"),
            defaultText(request.budgetLevel(), "보통"),
            defaultText(request.memo(), "없음"),
            candidateNames.isBlank() ? "지역 대표 명소" : candidateNames
        );
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

    private List<TravelPlanItem> parseGeneratedItems(TravelPlan plan, String content) throws java.io.IOException {
        JsonNode itineraryNode = objectMapper.readTree(extractJsonArray(content));
        List<Destination> candidates = destinationService.findCandidates(
                List.of(plan.getRegion().split("·")),
                LocalTripText.splitCsv(plan.getStyles()));
        List<TravelPlanItem> items = new ArrayList<>();
        int seq = 1;
        if (itineraryNode.isArray()) {
            for (JsonNode node : itineraryNode) {
                TravelPlanItem item = parseItem(plan, node, seq++, candidates);
                items.add(item);
            }
        }
        return items;
    }

    private String extractJsonArray(String content) {
        String normalized = content == null ? "" : content.trim();
        if (normalized.contains("```json")) {
            normalized = normalized.substring(normalized.indexOf("```json") + 7);
            normalized = normalized.substring(0, normalized.lastIndexOf("```"));
        } else if (normalized.contains("```")) {
            normalized = normalized.substring(normalized.indexOf("```") + 3);
            normalized = normalized.substring(0, normalized.lastIndexOf("```"));
        }
        int start = normalized.indexOf('[');
        int end = normalized.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return normalized.substring(start, end + 1);
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

    private TravelPlanItem parseItem(TravelPlan plan, JsonNode node, int sequence, List<Destination> candidates) {
        String destinationName = node.path("destinationName").asText("미정");
        Destination destination = matchDestination(destinationName, candidates);
        TravelPlanItem item = new TravelPlanItem();
        item.setTravelPlanId(plan.getId());
        item.setDayNumber(node.path("dayNumber").asInt(1));
        item.setSequenceNumber(sequence);
        item.setTimeSlot(normalizeTimeSlot(node.path("timeSlot").asText("09~10"), sequence));
        item.setDestinationName(destination == null ? destinationName : destination.getName());
        item.setDestinationId(destination == null ? null : destination.getId());
        item.setRegion(destination == null ? plan.getRegion() : destination.getRegion());
        item.setNote(limitText(node.path("note").asText(""), 240));
        item.setPrimaryStyle(limitText(node.path("primaryStyle").asText("관광"), 36));
        item.setDurationMinutes(60);
        return item;
    }

    private List<TravelPlanItem> fallbackItems(TravelPlan plan) {
        List<TravelPlanItem> items = new ArrayList<>();
        List<Destination> candidates = destinationService.findCandidates(
                List.of(plan.getRegion().split("·")),
                LocalTripText.splitCsv(plan.getStyles()));
        for (int day = 1; day <= plan.getDays(); day++) {
            for (int slotIndex = 0; slotIndex < TIME_SLOTS.size(); slotIndex++) {
                Destination destination = candidates.isEmpty() ? null : candidates.get((day + slotIndex - 1) % candidates.size());
                TravelPlanItem item = new TravelPlanItem();
                item.setTravelPlanId(plan.getId());
                item.setDayNumber(day);
                item.setSequenceNumber(((day - 1) * TIME_SLOTS.size()) + slotIndex + 1);
                item.setTimeSlot(TIME_SLOTS.get(slotIndex));
                item.setDestinationId(destination == null ? null : destination.getId());
                item.setDestinationName(destination == null ? plan.getRegion() + " 자유 여행" : destination.getName());
                item.setRegion(destination == null ? plan.getRegion() : destination.getRegion());
                item.setNote(limitText(fallbackNote(slotIndex, destination), 240));
                item.setPrimaryStyle(destination == null ? "자유" : destination.getPrimaryStyle());
                item.setDurationMinutes(60);
                items.add(item);
            }
        }
        return items;
    }

    @Transactional
    public List<TravelPlanResponse> listPlans() {
        schemaService.ensureSchema();
        return travelPlanRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(p -> TravelPlanResponse.from(
                        p,
                        travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(p.getId()),
                        destinationService.findCandidates(List.of(p.getRegion().split("·")), LocalTripText.splitCsv(p.getStyles()))))
                .toList();
    }

    @Transactional
    public TravelPlanResponse getPlan(Long id) {
        schemaService.ensureSchema();
        TravelPlan plan = travelPlanRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Travel plan not found"));
        return TravelPlanResponse.from(
                plan,
                travelPlanItemRepository.findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(id),
                destinationService.findCandidates(List.of(plan.getRegion().split("·")), LocalTripText.splitCsv(plan.getStyles())));
    }

    @Transactional
    public void deletePlan(Long id) {
        schemaService.ensureSchema();
        if (!travelPlanRepository.existsById(id)) {
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
        if (TIME_SLOTS.contains(normalized)) {
            return normalized;
        }
        return TIME_SLOTS.get(Math.floorMod(sequence - 1, TIME_SLOTS.size()));
    }

    private String fallbackNote(int slotIndex, Destination destination) {
        if (destination == null) {
            return "동선을 여유 있게 조정하며 주변 식사와 휴식 시간을 확보하세요.";
        }
        return switch (slotIndex) {
            case 0 -> destination.getDistrict() + " 도착 후 혼잡 전 핵심 포인트부터 둘러보세요.";
            case 1, 2 -> destination.getHeadline();
            case 3 -> destination.getName() + " 근처에서 식사와 짧은 휴식을 잡으세요.";
            case 4, 5, 6 -> destination.getDescription();
            case 7 -> "다음 장소 이동 전 사진 포인트와 기념품 구매 시간을 확보하세요.";
            default -> destination.getName() + " 주변 저녁 동선으로 하루를 마무리하세요.";
        };
    }

    private String limitText(String value, int maxLength) {
        String normalized = LocalTripText.normalize(value);
        if (normalized.length() <= maxLength) {
            return normalized;
        }
        return normalized.substring(0, maxLength);
    }
}
