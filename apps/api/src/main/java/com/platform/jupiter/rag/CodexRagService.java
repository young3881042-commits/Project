package com.platform.jupiter.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.platform.jupiter.chat.ChatCredentialService;
import com.platform.jupiter.chat.ChatUsage;
import com.platform.jupiter.chat.ChatUsageService;
import com.platform.jupiter.config.AppProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CodexRagService {
    private final ChatCredentialService chatCredentialService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final AppProperties appProperties;
    private final ChatUsageService chatUsageService;

    public CodexRagService(
            ChatCredentialService chatCredentialService,
            ObjectMapper objectMapper,
            AppProperties appProperties,
            ChatUsageService chatUsageService) {
        this.chatCredentialService = chatCredentialService;
        this.objectMapper = objectMapper;
        this.appProperties = appProperties;
        this.chatUsageService = chatUsageService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public String generate(String prompt, String username) throws IOException, InterruptedException {
        String apiKey = chatCredentialService.resolveOpenAiApiKey(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_OPENAI_API_KEY_MESSAGE));
        String payload = objectMapper.writeValueAsString(buildPayload(prompt));
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(normalizeBaseUrl(appProperties.codexApiBaseUrl()) + "/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Codex 요청에 실패했습니다. 개인 API 키를 연결하세요.");
        }
        JsonNode root = objectMapper.readTree(response.body());
        chatUsageService.recordUsage(username, "openai", codexModel(), extractUsage(root));
        return extractAssistantMessage(root);
    }

    private ObjectNode buildPayload(String prompt) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("model", codexModel());
        ArrayNode messages = payload.putArray("messages");
        ObjectNode system = messages.addObject();
        system.put("role", "system");
        system.put("content", "You are Codex used as a practical Korean RAG assistant. Answer from the supplied context first, keep uncertain parts explicit, and include actionable steps when useful.");
        ObjectNode user = messages.addObject();
        user.put("role", "user");
        user.put("content", prompt);
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

    private String codexModel() {
        String model = appProperties.codexModel();
        return model == null || model.isBlank() ? ChatCredentialService.DEFAULT_CODEX_MODEL : model.trim();
    }

    private String normalizeBaseUrl(String value) {
        String baseUrl = value == null || value.isBlank() ? "https://api.openai.com/v1" : value.trim();
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String summarize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.length() <= 220 ? normalized : normalized.substring(0, 220).trim() + "...";
    }
}
