package com.platform.jupiter.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.chat.ChatCredentialService;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GeminiRagService {
    private final ChatCredentialService chatCredentialService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public GeminiRagService(ChatCredentialService chatCredentialService, ObjectMapper objectMapper) {
        this.chatCredentialService = chatCredentialService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    public String generate(String prompt, String username) throws IOException, InterruptedException {
        try {
            String geminiToken = chatCredentialService.resolveGeminiAuthorization(username)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, ChatCredentialService.CONNECT_GEMINI_ACCOUNT_MESSAGE));
            String payload = objectMapper.writeValueAsString(buildGeminiPayload(prompt));
            return callChatApi(
                    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                    geminiToken,
                    payload,
                    "Gemini request failed");
        } catch (ResponseStatusException geminiError) {
            String openAiApiKey = chatCredentialService.resolveOpenAiApiKey(username)
                    .orElse("");
            if (openAiApiKey.isBlank()) {
                throw geminiError;
            }
            String payload = objectMapper.writeValueAsString(buildOpenAiPayload(prompt));
            return callChatApi("https://api.openai.com/v1/chat/completions", openAiApiKey, payload, "OpenAI request failed");
        }
    }

    private String callChatApi(String endpoint, String token, String payload, String errorPrefix) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, errorPrefix + ": HTTP " + response.statusCode());
        }
        JsonNode root = objectMapper.readTree(response.body());
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

    private Object buildGeminiPayload(String prompt) {
        List<Object> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", "You are a concise assistant."));
        messages.add(Map.of("role", "user", "content", prompt));
        return Map.of(
                "model", "gemini-2.5-flash",
                "messages", messages);
    }

    private Object buildOpenAiPayload(String prompt) {
        List<Object> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", "You are a concise assistant."));
        messages.add(Map.of("role", "user", "content", prompt));
        return Map.of(
                "model", "gpt-4o-mini",
                "messages", messages,
                "temperature", 0.2);
    }
}
