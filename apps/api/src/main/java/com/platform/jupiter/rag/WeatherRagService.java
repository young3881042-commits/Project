package com.platform.jupiter.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.jupiter.config.AppProperties;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
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
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class WeatherRagService {
    private static final Logger log = LoggerFactory.getLogger(WeatherRagService.class);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
            .withZone(ZoneId.of("Asia/Seoul"));

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final VectorStoreService vectorStoreService;
    private final HttpClient httpClient;

    private volatile Instant lastUpdatedAt;

    public WeatherRagService(AppProperties appProperties, ObjectMapper objectMapper, VectorStoreService vectorStoreService) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
        this.vectorStoreService = vectorStoreService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public boolean enabled() {
        return Boolean.TRUE.equals(appProperties.ragWeatherEnabled());
    }

    public WeatherRagStatusResponse refresh(Path sourceRoot) {
        List<WeatherLocation> locations = parseLocations();
        if (!enabled()) {
            return new WeatherRagStatusResponse(false, vectorStoreService.isConfigured(), vectorStoreService.collectionName(),
                    lastUpdatedAt, locations.size(), locations.stream().map(WeatherLocation::name).toList(), "disabled");
        }

        Path weatherDocument = weatherDocument(sourceRoot);

        List<String> sections = new ArrayList<>();
        List<String> availableLocations = new ArrayList<>();
        for (WeatherLocation location : locations) {
            try {
                sections.add(fetchWeatherSection(location));
                availableLocations.add(location.name());
            } catch (Exception exception) {
                log.warn("Weather fetch failed for {}: {}", location.name(), exception.getMessage());
            }
        }

        if (sections.isEmpty()) {
            if (Files.exists(weatherDocument)) {
                try {
                    lastUpdatedAt = Files.getLastModifiedTime(weatherDocument).toInstant();
                } catch (IOException ignored) {
                    lastUpdatedAt = Instant.now();
                }
                return new WeatherRagStatusResponse(
                        true,
                        vectorStoreService.isConfigured(),
                        vectorStoreService.collectionName(),
                        lastUpdatedAt,
                        locations.size(),
                        locations.stream().map(WeatherLocation::name).toList(),
                        "cached");
            }

            String fallback = buildOfflineDocument(locations);
            try {
                Files.createDirectories(sourceRoot);
                Files.writeString(weatherDocument, fallback, StandardCharsets.UTF_8);
                lastUpdatedAt = Files.getLastModifiedTime(weatherDocument).toInstant();
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to persist fallback weather RAG document", exception);
            }
            return new WeatherRagStatusResponse(
                    true,
                    vectorStoreService.isConfigured(),
                    vectorStoreService.collectionName(),
                    lastUpdatedAt,
                    locations.size(),
                    locations.stream().map(WeatherLocation::name).toList(),
                    "offline");
        }

        String document = buildDocument(sections);
        try {
            Files.createDirectories(sourceRoot);
            Files.writeString(weatherDocument, document, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to persist weather RAG document", exception);
        }

        try {
            lastUpdatedAt = Files.getLastModifiedTime(weatherDocument).toInstant();
        } catch (IOException ignored) {
            lastUpdatedAt = Instant.now();
        }
        return new WeatherRagStatusResponse(
                true,
                vectorStoreService.isConfigured(),
                vectorStoreService.collectionName(),
                lastUpdatedAt,
                availableLocations.size(),
                availableLocations,
                "open-meteo");
    }

    public WeatherRagStatusResponse status() {
        List<WeatherLocation> locations = parseLocations();
        String source = enabled() ? "open-meteo" : "disabled";
        if (lastUpdatedAt == null) {
            Path weatherDocument = weatherDocument(Path.of(appProperties.ragSourceRoot()));
            if (Files.exists(weatherDocument)) {
                try {
                    lastUpdatedAt = Files.getLastModifiedTime(weatherDocument).toInstant();
                    source = "cached";
                } catch (IOException ignored) {
                    source = "cached";
                }
            }
        }
        return new WeatherRagStatusResponse(
                enabled(),
                vectorStoreService.isConfigured(),
                vectorStoreService.collectionName(),
                lastUpdatedAt,
                locations.size(),
                locations.stream().map(WeatherLocation::name).toList(),
                source);
    }

    private String buildDocument(List<String> sections) {
        StringBuilder builder = new StringBuilder();
        builder.append("# Korea live weather RAG source\n\n");
        builder.append("Updated at: ").append(TIME_FORMAT.format(Instant.now())).append(" KST\n");
        builder.append("Source: Open-Meteo current, hourly, daily forecast API\n\n");
        for (String section : sections) {
            builder.append(section).append("\n\n");
        }
        builder.append("Use this document for questions about current weather, short-term rain risk, wind, humidity, and temperature differences between cities.\n");
        return builder.toString().trim();
    }

    private String buildOfflineDocument(List<WeatherLocation> locations) {
        StringBuilder builder = new StringBuilder();
        builder.append("# Korea weather RAG source\n\n");
        builder.append("Updated at: ").append(TIME_FORMAT.format(Instant.now())).append(" KST\n");
        builder.append("Source: offline fallback\n\n");
        builder.append("Live weather refresh is currently unavailable because the server cannot reach the external weather API.\n");
        builder.append("Questions about exact current temperature, rainfall, humidity, or wind may be incomplete until connectivity is restored.\n\n");
        builder.append("Configured locations:\n");
        for (WeatherLocation location : locations) {
            builder.append("- ").append(location.name())
                    .append(" (")
                    .append(location.latitude())
                    .append(", ")
                    .append(location.longitude())
                    .append(")\n");
        }
        builder.append("\nUse this document only to explain that live weather data is temporarily unavailable.");
        return builder.toString().trim();
    }

    private Path weatherDocument(Path sourceRoot) {
        return sourceRoot.resolve("weather-live.md");
    }

    private String fetchWeatherSection(WeatherLocation location) throws IOException, InterruptedException {
        String query = appProperties.weatherApiBaseUrl()
                + "?latitude=" + encode(Double.toString(location.latitude()))
                + "&longitude=" + encode(Double.toString(location.longitude()))
                + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
                + "&hourly=temperature_2m,precipitation_probability,precipitation,weather_code"
                + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum"
                + "&forecast_days=2"
                + "&timezone=Asia%2FSeoul";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(query))
                .timeout(Duration.ofSeconds(20))
                .header("Accept", "application/json")
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode current = root.path("current");
        JsonNode hourly = root.path("hourly");
        JsonNode daily = root.path("daily");

        StringBuilder builder = new StringBuilder();
        builder.append("## ").append(location.name()).append("\n");
        builder.append("- Current observed time: ").append(current.path("time").asText("unknown")).append("\n");
        builder.append("- Current temperature: ").append(current.path("temperature_2m").asDouble()).append("C\n");
        builder.append("- Feels like: ").append(current.path("apparent_temperature").asDouble()).append("C\n");
        builder.append("- Humidity: ").append(current.path("relative_humidity_2m").asInt()).append("%\n");
        builder.append("- Wind speed: ").append(current.path("wind_speed_10m").asDouble()).append(" km/h\n");
        builder.append("- Current precipitation: ").append(current.path("precipitation").asDouble()).append(" mm\n");
        builder.append("- Weather summary: ").append(weatherCodeLabel(current.path("weather_code").asInt(-1))).append("\n");
        builder.append("- Today max/min: ")
                .append(daily.path("temperature_2m_max").path(0).asDouble())
                .append("C / ")
                .append(daily.path("temperature_2m_min").path(0).asDouble())
                .append("C\n");
        builder.append("- Today precipitation total: ").append(daily.path("precipitation_sum").path(0).asDouble()).append(" mm\n");
        builder.append("- Next 6 hours:\n");

        JsonNode times = hourly.path("time");
        JsonNode temperatures = hourly.path("temperature_2m");
        JsonNode rainChance = hourly.path("precipitation_probability");
        JsonNode precipitation = hourly.path("precipitation");
        JsonNode codes = hourly.path("weather_code");
        int count = Math.min(6, times.size());
        for (int index = 0; index < count; index++) {
            builder.append("  - ")
                    .append(times.path(index).asText(""))
                    .append(": ")
                    .append(temperatures.path(index).asDouble())
                    .append("C, rain chance ")
                    .append(rainChance.path(index).asInt())
                    .append("%, precipitation ")
                    .append(precipitation.path(index).asDouble())
                    .append(" mm, ")
                    .append(weatherCodeLabel(codes.path(index).asInt(-1)))
                    .append("\n");
        }
        return builder.toString().trim();
    }

    private List<WeatherLocation> parseLocations() {
        String raw = appProperties.weatherLocations();
        if (raw == null || raw.isBlank()) {
            return List.of();
        }

        List<WeatherLocation> locations = new ArrayList<>();
        for (String token : raw.split(";")) {
            if (token.isBlank()) {
                continue;
            }
            String[] parts = token.split(":");
            if (parts.length != 3) {
                continue;
            }
            String name = parts[0].trim();
            double latitude = Double.parseDouble(parts[1].trim());
            double longitude = Double.parseDouble(parts[2].trim());
            locations.add(new WeatherLocation(name, latitude, longitude));
        }
        return locations;
    }

    private String weatherCodeLabel(int code) {
        return switch (code) {
            case 0 -> "clear sky";
            case 1, 2, 3 -> "partly cloudy";
            case 45, 48 -> "fog";
            case 51, 53, 55, 56, 57 -> "drizzle";
            case 61, 63, 65, 66, 67, 80, 81, 82 -> "rain";
            case 71, 73, 75, 77, 85, 86 -> "snow";
            case 95, 96, 99 -> "thunderstorm";
            default -> "mixed conditions";
        };
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record WeatherLocation(String name, double latitude, double longitude) {
    }
}
