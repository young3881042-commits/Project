package com.platform.jupiter.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class DomainRagCollectorService {
    private static final Logger log = LoggerFactory.getLogger(DomainRagCollectorService.class);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
            .withZone(ZoneId.of("UTC"));

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public DomainRagCollectorService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public DomainRagStatusResponse collect(Path sourceRoot) {
        Path domainRoot = sourceRoot.resolve("domain-collections");
        try {
            Files.createDirectories(domainRoot);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create domain collection directory", exception);
        }

        Map<String, List<String>> topicMap = defaultTopics();
        Instant now = Instant.now();
        int saved = 0;

        for (Map.Entry<String, List<String>> entry : topicMap.entrySet()) {
            String domain = entry.getKey();
            List<String> topics = entry.getValue();
            String content = buildDomainDocument(domain, topics, now);
            if (content.isBlank()) {
                continue;
            }
            Path file = domainRoot.resolve(domain + "-live.md");
            try {
                Files.writeString(file, content, StandardCharsets.UTF_8);
                saved++;
            } catch (IOException exception) {
                log.warn("Failed to write domain RAG file {}: {}", file, exception.getMessage());
            }
        }

        return new DomainRagStatusResponse(
                new ArrayList<>(topicMap.keySet()),
                saved,
                now,
                "Wikipedia REST summary API");
    }

    public DomainRagStatusResponse status(Path sourceRoot) {
        Path domainRoot = sourceRoot.resolve("domain-collections");
        if (!Files.exists(domainRoot)) {
            return new DomainRagStatusResponse(List.of(), 0, null, "Wikipedia REST summary API");
        }

        List<Path> files;
        try (Stream<Path> stream = Files.list(domainRoot)) {
            files = stream.filter(Files::isRegularFile).sorted().toList();
        } catch (IOException exception) {
            return new DomainRagStatusResponse(List.of(), 0, null, "Wikipedia REST summary API");
        }

        Instant lastModified = null;
        List<String> domains = new ArrayList<>();
        for (Path file : files) {
            String filename = file.getFileName().toString();
            if (filename.endsWith("-live.md")) {
                domains.add(filename.replace("-live.md", ""));
            }
            try {
                Instant modified = Files.getLastModifiedTime(file).toInstant();
                if (lastModified == null || modified.isAfter(lastModified)) {
                    lastModified = modified;
                }
            } catch (IOException ignored) {
                // best effort
            }
        }

        return new DomainRagStatusResponse(domains, files.size(), lastModified, "Wikipedia REST summary API");
    }

    private String buildDomainDocument(String domain, List<String> topics, Instant now) {
        StringBuilder builder = new StringBuilder();
        builder.append("# ").append(capitalize(domain)).append(" domain briefing\n\n");
        builder.append("- collected_at_utc: ").append(DATE_TIME_FORMATTER.format(now)).append("\n");
        builder.append("- source: Wikipedia REST summary API\n");
        builder.append("- purpose: 실사용 RAG용 다분야 기초 지식 업데이트\n\n");
        int included = 0;
        for (String topic : topics) {
            String summary = fetchSummary(topic);
            if (summary.isBlank()) {
                continue;
            }
            included++;
            builder.append("## ").append(topic.replace('_', ' ')).append("\n");
            builder.append(summary.trim()).append("\n\n");
        }

        if (included == 0) {
            return "";
        }

        builder.append("## 운영 메모\n");
        builder.append("이 문서는 자동 수집된 분야별 배경지식이며, 답변 시 최신성·정확성 검증이 필요한 영역은 별도 확인이 필요합니다.\n");
        return builder.toString().trim() + "\n";
    }

    private String fetchSummary(String topic) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://en.wikipedia.org/api/rest_v1/page/summary/" + topic))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("User-Agent", "jupiter-rag-bot/1.0")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return "";
            }
            JsonNode root = objectMapper.readTree(response.body());
            String extract = root.path("extract").asText("").trim();
            return normalize(extract);
        } catch (Exception exception) {
            return "";
        }
    }

    private String normalize(String value) {
        return value.replace("\r", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .replaceAll("\\s{2,}", " ")
                .trim();
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "Domain";
        }
        String lowered = value.toLowerCase(Locale.ROOT);
        return Character.toUpperCase(lowered.charAt(0)) + lowered.substring(1);
    }

    private Map<String, List<String>> defaultTopics() {
        Map<String, List<String>> topics = new LinkedHashMap<>();
        topics.put("finance", List.of("Inflation", "Interest_rate", "Gross_domestic_product", "Exchange_rate"));
        topics.put("healthcare", List.of("Public_health", "Vaccination", "Telemedicine", "Mental_health"));
        topics.put("technology", List.of("Large_language_model", "Cloud_computing", "Data_security", "MLOps"));
        topics.put("manufacturing", List.of("Supply_chain", "Lean_manufacturing", "Quality_control", "Industrial_automation"));
        topics.put("energy", List.of("Renewable_energy", "Power_grid", "Energy_storage", "Carbon_pricing"));
        topics.put("logistics", List.of("Logistics", "Last_mile_(transportation)", "Cold_chain", "Freight_transport"));
        return topics;
    }
}
