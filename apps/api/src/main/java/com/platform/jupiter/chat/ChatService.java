package com.platform.jupiter.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.files.FileService;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final DateTimeFormatter FILE_STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
            .withZone(ZoneId.of("Asia/Seoul"));

    private final FileService fileService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AppProperties appProperties;
    private final ChatCredentialService chatCredentialService;
    private final ChatUsageService chatUsageService;

    public ChatService(
            FileService fileService,
            ObjectMapper objectMapper,
            AppProperties appProperties,
            ChatCredentialService chatCredentialService,
            ChatUsageService chatUsageService) {
        this.fileService = fileService;
        this.objectMapper = objectMapper;
        this.appProperties = appProperties;
        this.chatCredentialService = chatCredentialService;
        this.chatUsageService = chatUsageService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public ChatResponse chat(ChatRequest request, String username, boolean admin) {
        ModelResult modelResult = requestModel(request, username);
        String assistantMessage = modelResult.message();
        chatUsageService.recordUsage(username, request.providerId(), request.model(), modelResult.usage());
        Instant now = Instant.now();
        String transcriptPath = resolveTranscriptPath(request, now);
        String title = resolveTitle(request);
        List<ChatMessage> transcriptMessages = new ArrayList<>(request.messages());
        transcriptMessages.add(new ChatMessage("assistant", assistantMessage));
        String transcript = maskSensitive(renderTranscript(request, transcriptMessages, title, now));
        fileService.writeWorkspaceFile(transcriptPath, transcript, username, admin);
        writeConversationArchive(username, transcriptPath, transcript);
        appendConversationHistory(username, request, transcriptPath, title, now, modelResult.usage(), transcriptMessages);
        return new ChatResponse(assistantMessage, transcriptPath, title, now, modelResult.usage());
    }

    private ModelResult requestModel(ChatRequest request, String username) {
        try {
            String payload = objectMapper.writeValueAsString(buildPayload(request));
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(request.baseUrl()) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8));
            String apiKey = resolveApiKey(request, username);
            if (apiKey != null && !apiKey.isBlank()) {
                builder.header("Authorization", "Bearer " + apiKey.trim());
            }

            HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                if (response.statusCode() == 429) {
                    log.warn("Model API 429 status from provider={}, body={}", request.providerId(), summarize(maskSensitive(response.body())));
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "개인 API 키의 사용량 한도 또는 모델 접근 권한 문제로 요청에 실패했습니다. 개인 API 키를 연결하세요.");
                }
                log.warn("Model API request failed from provider={}, status={}, body={}", request.providerId(), response.statusCode(), summarize(maskSensitive(response.body())));
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "모델 API 요청에 실패했습니다. 개인 API 키를 연결하세요.");
            }
            JsonNode root = objectMapper.readTree(response.body());
            String content = extractAssistantMessage(root);
            if (content.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Model API returned an empty answer");
            }
            return new ModelResult(content, extractUsage(root));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to parse model API response", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Model API request was interrupted", e);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid API base URL", e);
        }
    }

    private Map<String, Object> buildPayload(ChatRequest request) {
        List<Map<String, String>> messages = new ArrayList<>();
        if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
            messages.add(Map.of("role", "system", "content", request.systemPrompt().trim()));
        }
        for (ChatMessage message : request.messages()) {
            messages.add(Map.of("role", message.role().trim(), "content", message.content()));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", resolveModel(request.model()));
        payload.put("messages", messages);
        return payload;
    }

    private String extractAssistantMessage(JsonNode root) {
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (content.isTextual()) {
            return content.asText().trim();
        }
        if (content.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode item : content) {
                String text = item.path("text").asText("");
                if (!text.isBlank()) {
                    if (builder.length() > 0) {
                        builder.append("\n");
                    }
                    builder.append(text.trim());
                }
            }
            return builder.toString().trim();
        }
        return "";
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

    private String resolveTranscriptPath(ChatRequest request, Instant now) {
        if (request.filePath() != null && !request.filePath().isBlank()) {
            return request.filePath().trim();
        }
        String directoryPath = request.directoryPath() == null ? "" : request.directoryPath().trim();
        String filename = FILE_STAMP.format(now) + "-" + slugify(resolveTitle(request)) + ".md";
        if (directoryPath.isBlank()) {
            return filename;
        }
        return directoryPath + "/" + filename;
    }

    private String resolveTitle(ChatRequest request) {
        if (request.title() != null && !request.title().isBlank()) {
            return request.title().trim();
        }
        for (int index = request.messages().size() - 1; index >= 0; index--) {
            ChatMessage message = request.messages().get(index);
            if ("user".equalsIgnoreCase(message.role()) && !message.content().isBlank()) {
                return summarize(message.content());
            }
        }
        return "chat-session";
    }

    private String renderTranscript(ChatRequest request, List<ChatMessage> messages, String title, Instant savedAt) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(title).append("\n\n");
        builder.append("- saved_at: ").append(savedAt).append("\n");
        builder.append("- provider: ").append(request.providerId().trim()).append("\n");
        builder.append("- model: ").append(request.model().trim()).append("\n");
        builder.append("- api_base: ").append(maskSensitive(normalizeBaseUrl(request.baseUrl()))).append("\n");
        builder.append("- directory: ").append(request.directoryPath() == null || request.directoryPath().isBlank() ? "/" : request.directoryPath().trim()).append("\n");
        builder.append("\n");
        if (request.systemPrompt() != null && !request.systemPrompt().isBlank()) {
            builder.append("## System\n\n");
            builder.append(request.systemPrompt().trim()).append("\n\n");
        }
        builder.append("## Conversation\n\n");
        for (ChatMessage message : messages) {
            builder.append("### ").append(message.role().trim()).append("\n\n");
            builder.append(message.content().trim()).append("\n\n");
        }
        return builder.toString().trim() + "\n";
    }

    private void writeConversationArchive(String username, String transcriptPath, String transcript) {
        Path userRoot = conversationUserRoot(username);
        Path target = resolveConversationPath(userRoot.resolve("transcripts").normalize(), transcriptPath);
        Path latest = userRoot.resolve("latest.md").normalize();
        if (!latest.startsWith(userRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid latest conversation path");
        }
        try {
            Path parent = target.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(
                    target,
                    transcript,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
            Files.writeString(
                    latest,
                    transcript,
                    StandardOpenOption.CREATE,
                    StandardOpenOption.TRUNCATE_EXISTING,
                    StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to write conversation archive", e);
        }
    }

    private void appendConversationHistory(
            String username,
            ChatRequest request,
            String transcriptPath,
            String title,
            Instant savedAt,
            ChatUsage usage,
            List<ChatMessage> messages) {
        Path userRoot = conversationUserRoot(username);
        Path historyFile = userRoot.resolve("history.jsonl").normalize();
        if (!historyFile.startsWith(userRoot)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid conversation history path");
        }
        try {
            Files.createDirectories(userRoot);
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("savedAt", savedAt.toString());
            event.put("title", maskSensitive(title));
            event.put("provider", request.providerId().trim());
            event.put("model", request.model().trim());
            event.put("apiBase", maskSensitive(normalizeBaseUrl(request.baseUrl())));
            event.put("workspaceTranscriptPath", transcriptPath);
            event.put("messages", messages.stream()
                    .map(message -> Map.of(
                            "role", message.role().trim(),
                            "content", maskSensitive(message.content().trim())))
                    .toList());
            event.put("usage", Map.of(
                    "inputTokens", usage.inputTokens(),
                    "outputTokens", usage.outputTokens(),
                    "totalTokens", usage.totalTokens()));
            Files.writeString(
                    historyFile,
                    objectMapper.writeValueAsString(event) + "\n",
                    StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND,
                    StandardOpenOption.WRITE);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to append conversation history", e);
        }
    }

    private Path conversationUserRoot(String username) {
        return conversationRoot().resolve(conversationUsername(username)).normalize();
    }

    private Path conversationRoot() {
        String configured = appProperties.conversationRoot();
        if (configured == null || configured.isBlank()) {
            String assistantRoot = appProperties.assistantDataRoot();
            if (assistantRoot == null || assistantRoot.isBlank()) {
                configured = "/data/jupiter-assistant/conversations";
            } else {
                configured = Path.of(assistantRoot.trim()).resolve("conversations").toString();
            }
        }
        return Path.of(configured.trim()).normalize();
    }

    private Path resolveConversationPath(Path root, String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Conversation transcript path is required");
        }
        Path relative = Path.of(relativePath.replace('\\', '/')).normalize();
        if (relative.isAbsolute()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid conversation transcript path");
        }
        Path resolved = root.resolve(relative).normalize();
        if (!resolved.startsWith(root)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid conversation transcript path");
        }
        return resolved;
    }

    private String conversationUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Conversation user is required");
        }
        String normalized = username.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("[a-zA-Z0-9._-]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid conversation user");
        }
        return normalized;
    }

    private String normalizeBaseUrl(String baseUrl) {
        String trimmed = baseUrl.trim();
        if (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (!trimmed.matches(".*/v\\d[^/]*(/.*)?$")) {
            trimmed = trimmed + "/v1";
        }
        return trimmed;
    }

    private String resolveApiKey(ChatRequest request, String username) {
        String providerId = request.providerId() == null ? "" : request.providerId().trim().toLowerCase();
        if ("openai".equals(providerId)) {
            return chatCredentialService.resolveOpenAiApiKey(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_OPENAI_API_KEY_MESSAGE));
        }
        if ("gemini".equals(providerId)) {
            return chatCredentialService.resolveGeminiAuthorization(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_GEMINI_ACCOUNT_MESSAGE));
        }
        String normalizedBaseUrl = normalizeBaseUrl(request.baseUrl()).toLowerCase();
        String model = request.model() == null ? "" : request.model().trim().toLowerCase();
        if (normalizedBaseUrl.contains("api.openai.com") || model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4")) {
            return chatCredentialService.resolveOpenAiApiKey(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_OPENAI_API_KEY_MESSAGE));
        }
        if (normalizedBaseUrl.contains("x.ai") || model.startsWith("grok")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_PERSONAL_API_KEY_MESSAGE + " Grok 사용자 키 연결은 아직 지원되지 않습니다.");
        }
        if (normalizedBaseUrl.contains("generativelanguage.googleapis.com") || model.startsWith("gemini")) {
            return chatCredentialService.resolveGeminiAuthorization(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_GEMINI_ACCOUNT_MESSAGE));
        }
        return "";
    }

    private String resolveModel(String requestedModel) {
        if (requestedModel != null && !requestedModel.isBlank()) {
            return requestedModel.trim();
        }
        if (appProperties.openAiModel() != null && !appProperties.openAiModel().isBlank()) {
            return appProperties.openAiModel().trim();
        }
        return "gpt-5.2-codex";
    }

    private String maskSensitive(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value
                .replaceAll("(?i)(\"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\"\\s*:\\s*\")[^\"]+(\")", "$1[REDACTED]$2")
                .replaceAll("(?i)\\b(api[_-]?key|access_token|refresh_token|client_secret|token|password)=([^\\s&]+)", "$1=[REDACTED]")
                .replaceAll("(?i)authorization\\s*:\\s*bearer\\s+[A-Za-z0-9._\\-]+", "authorization: bearer [REDACTED]")
                .replaceAll("(?i)bearer\\s+[A-Za-z0-9._\\-]+", "bearer [REDACTED]")
                .replaceAll("(?i)sk-proj-[A-Za-z0-9_-]+", "sk-proj-[REDACTED]")
                .replaceAll("(?i)sk-[A-Za-z0-9_-]+", "sk-[REDACTED]")
                .replaceAll("AIza[0-9A-Za-z_-]{20,}", "AIza[REDACTED]");
    }

    private String summarize(String value) {
        String normalized = value.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 48) {
            return normalized;
        }
        return normalized.substring(0, 48).trim() + "...";
    }

    private String slugify(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("[^\\p{Alnum}\\s-]", " ")
                .replaceAll("\\s+", "-")
                .replaceAll("-{2,}", "-")
                .toLowerCase()
                .replaceAll("(^-|-$)", "");
        return normalized.isBlank() ? "chat-session" : normalized;
    }

    private record ModelResult(String message, ChatUsage usage) {
    }
}
