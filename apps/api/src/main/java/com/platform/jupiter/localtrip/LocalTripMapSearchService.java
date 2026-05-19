package com.platform.jupiter.localtrip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class LocalTripMapSearchService {
    private static final int LIMIT = 8;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public LocalTripMapSearchService(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(4))
                .build();
    }

    public List<MapPlaceResponse> search(String query) {
        String text = query == null ? "" : query.trim();
        if (text.length() < 2) {
            return List.of();
        }
        if (appProperties.kakaoRestApiKey() != null && !appProperties.kakaoRestApiKey().isBlank()) {
            List<MapPlaceResponse> kakaoResults = searchKakao(text);
            if (!kakaoResults.isEmpty()) {
                return kakaoResults;
            }
        }
        return searchNominatim(text);
    }

    private List<MapPlaceResponse> searchKakao(String query) {
        try {
            URI uri = URI.create("https://dapi.kakao.com/v2/local/search/keyword.json?size=" + LIMIT
                    + "&query=" + encode(query));
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(5))
                    .header("Authorization", "KakaoAK " + appProperties.kakaoRestApiKey())
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return List.of();
            }
            JsonNode documents = objectMapper.readTree(response.body()).path("documents");
            List<MapPlaceResponse> results = new ArrayList<>();
            for (JsonNode item : documents) {
                results.add(new MapPlaceResponse(
                        item.path("place_name").asText(""),
                        item.path("address_name").asText(""),
                        item.path("road_address_name").asText(""),
                        item.path("category_group_name").asText(item.path("category_name").asText("")),
                        item.path("y").asText(""),
                        item.path("x").asText(""),
                        "kakao"));
            }
            return results;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<MapPlaceResponse> searchNominatim(String query) {
        try {
            URI uri = URI.create("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=" + LIMIT
                    + "&accept-language=ko,en&q=" + encode(query));
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(5))
                    .header("Accept", "application/json")
                    .header("User-Agent", "LocalTrip/1.0")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                return List.of();
            }
            JsonNode rows = objectMapper.readTree(response.body());
            List<MapPlaceResponse> results = new ArrayList<>();
            for (JsonNode item : rows) {
                String displayName = item.path("display_name").asText("");
                String name = displayName.contains(",") ? displayName.substring(0, displayName.indexOf(',')).trim() : displayName;
                results.add(new MapPlaceResponse(
                        name.isBlank() ? query : name,
                        displayName,
                        "",
                        item.path("type").asText(item.path("class").asText("")),
                        item.path("lat").asText(""),
                        item.path("lon").asText(""),
                        "openstreetmap"));
            }
            return results;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
