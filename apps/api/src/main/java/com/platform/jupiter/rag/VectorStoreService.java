package com.platform.jupiter.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.platform.jupiter.config.AppProperties;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class VectorStoreService {
    private static final Logger log = LoggerFactory.getLogger(VectorStoreService.class);

    private final ObjectMapper objectMapper;
    private final String qdrantUrl;
    private final String collectionName;
    private final int dimensions;
    private final HttpClient httpClient;

    public VectorStoreService(ObjectMapper objectMapper, AppProperties appProperties) {
        this.objectMapper = objectMapper;
        this.qdrantUrl = trimTrailingSlash(appProperties.qdrantUrl());
        this.collectionName = appProperties.ragCollection();
        this.dimensions = appProperties.ragEmbeddingDimensions() == null ? 128 : appProperties.ragEmbeddingDimensions();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean isConfigured() {
        return qdrantUrl != null && !qdrantUrl.isBlank();
    }

    public String collectionName() {
        return collectionName;
    }

    public boolean resetCollection() {
        if (!isConfigured()) {
            return false;
        }

        delete("/collections/" + collectionName);
        return ensureCollection();
    }

    public boolean ensureCollection() {
        if (!isConfigured()) {
            return false;
        }

        ObjectNode body = objectMapper.createObjectNode();
        ObjectNode vectors = body.putObject("vectors");
        vectors.put("size", dimensions);
        vectors.put("distance", "Cosine");
        return put("/collections/" + collectionName, body);
    }

    public boolean upsertChunks(List<VectorPoint> points) {
        if (!isConfigured() || points.isEmpty()) {
            return false;
        }

        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode pointsNode = body.putArray("points");
        for (VectorPoint point : points) {
            ObjectNode pointNode = pointsNode.addObject();
            pointNode.put("id", point.id());
            ArrayNode vectorNode = pointNode.putArray("vector");
            for (float value : point.vector()) {
                vectorNode.add(value);
            }

            ObjectNode payload = pointNode.putObject("payload");
            payload.put("documentId", point.documentId());
            payload.put("documentTitle", point.documentTitle());
            payload.put("chunkIndex", point.chunkIndex());
            payload.put("text", point.text());
            payload.put("category", point.category());
        }

        return put("/collections/" + collectionName + "/points?wait=true", body);
    }

    public List<SearchResult> search(float[] vector, int limit) {
        if (!isConfigured() || vector.length == 0 || limit <= 0) {
            return List.of();
        }

        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode vectorNode = body.putArray("vector");
        for (float value : vector) {
            vectorNode.add(value);
        }
        body.put("limit", limit);
        body.put("with_payload", true);

        try {
            JsonNode root = post("/collections/" + collectionName + "/points/search", body);
            JsonNode result = root.path("result");
            if (!result.isArray()) {
                return List.of();
            }

            List<SearchResult> matches = new ArrayList<>();
            for (JsonNode node : result) {
                JsonNode payload = node.path("payload");
                matches.add(new SearchResult(
                        payload.path("documentId").asText(""),
                        payload.path("documentTitle").asText(""),
                        payload.path("chunkIndex").asInt(0),
                        payload.path("text").asText(""),
                        payload.path("category").asText(""),
                        node.path("score").asDouble(0)));
            }
            return matches;
        } catch (Exception exception) {
            log.warn("Vector search failed against Qdrant: {}", exception.getMessage());
            return List.of();
        }
    }

    public String pointId(String documentId, int chunkIndex) {
        return UUID.nameUUIDFromBytes((documentId + "#" + chunkIndex).getBytes()).toString();
    }

    private boolean put(String path, JsonNode body) {
        try {
            send("PUT", path, body);
            return true;
        } catch (Exception exception) {
            log.warn("Qdrant PUT failed for {}: {}", path, exception.getMessage());
            return false;
        }
    }

    private void delete(String path) {
        try {
            send("DELETE", path, null);
        } catch (Exception exception) {
            log.debug("Qdrant DELETE skipped for {}: {}", path, exception.getMessage());
        }
    }

    private JsonNode post(String path, JsonNode body) throws IOException, InterruptedException {
        return send("POST", path, body);
    }

    private JsonNode send(String method, String path, JsonNode body) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(qdrantUrl + path))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json");

        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.method(method, HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " from Qdrant");
        }

        String payload = response.body();
        return payload == null || payload.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(payload);
    }

    private String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    public record VectorPoint(
            String id,
            String documentId,
            String documentTitle,
            int chunkIndex,
            String text,
            String category,
            float[] vector) {
    }

    public record SearchResult(
            String documentId,
            String documentTitle,
            int chunkIndex,
            String text,
            String category,
            double score) {
    }
}
