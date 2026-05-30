package com.platform.jupiter.localtrip;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class TourApiClient {
    private static final List<String> AREA_CODES = List.of("1", "2", "3", "4", "5", "6", "7", "8", "31", "32", "33", "34", "35", "36", "37", "38", "39");
    private static final List<String> CONTENT_TYPES = List.of("12", "14", "15", "28", "39");
    private static final int PAGE_SIZE = 1000;
    private static final int MAX_PAGES_PER_QUERY = 200;
    private static final long REQUEST_PAUSE_MILLIS = 120L;
    private final TourApiProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public TourApiClient(TourApiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restClient = RestClient.builder().build();
    }

    public List<TourApiDestination> fetchAreaBasedDestinations() {
        if (!properties.hasServiceKey()) {
            return List.of();
        }
        Map<String, TourApiDestination> destinationsById = new LinkedHashMap<>();
        for (String areaCode : AREA_CODES) {
            for (String contentTypeId : CONTENT_TYPES) {
                for (TourApiDestination destination : fetchAreaBasedDestinations(areaCode, contentTypeId)) {
                    destinationsById.put(destination.contentId(), destination);
                }
                pauseBetweenRequests();
            }
        }
        return new ArrayList<>(destinationsById.values());
    }

    private List<TourApiDestination> fetchAreaBasedDestinations(String areaCode, String contentTypeId) {
        List<TourApiDestination> destinations = new ArrayList<>();
        for (int pageNo = 1; pageNo <= MAX_PAGES_PER_QUERY; pageNo++) {
            TourApiPage page = fetchAreaBasedDestinations(areaCode, contentTypeId, pageNo);
            if (page.destinations().isEmpty()) {
                break;
            }
            destinations.addAll(page.destinations());
            if (page.isLastPage(PAGE_SIZE)) {
                break;
            }
            pauseBetweenRequests();
        }
        return destinations;
    }

    private TourApiPage fetchAreaBasedDestinations(String areaCode, String contentTypeId, int pageNo) {
        URI uri = UriComponentsBuilder.fromHttpUrl(properties.baseUrlOrDefault())
                .path("/areaBasedList2")
                .queryParam("MobileOS", "ETC")
                .queryParam("MobileApp", "JupiterLocalTrip")
                .queryParam("_type", "json")
                .queryParam("arrange", "Q")
                .queryParam("numOfRows", PAGE_SIZE)
                .queryParam("pageNo", pageNo)
                .queryParam("areaCode", areaCode)
                .queryParam("contentTypeId", contentTypeId)
                .queryParam("serviceKey", properties.serviceKey())
                .build(true)
                .toUri();

        String body = restClient.get()
                .uri(uri)
                .accept(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(String.class);
        return parseDestinationsPage(body);
    }

    private TourApiPage parseDestinationsPage(String body) {
        if (body == null || body.isBlank()) {
            return TourApiPage.empty();
        }
        try {
            JsonNode responseBody = objectMapper.readTree(body)
                    .path("response")
                    .path("body");
            JsonNode items = responseBody
                    .path("items")
                    .path("item");
            if (items.isMissingNode() || items.isNull()) {
                return new TourApiPage(
                        List.of(),
                        responseBody.path("totalCount").asInt(0),
                        responseBody.path("numOfRows").asInt(PAGE_SIZE),
                        responseBody.path("pageNo").asInt(1));
            }
            List<TourApiDestination> destinations = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode item : items) {
                    destinations.add(toDestination(item));
                }
            } else {
                destinations.add(toDestination(items));
            }
            return new TourApiPage(
                    destinations.stream()
                            .filter(destination -> !destination.contentId().isBlank() && !destination.title().isBlank())
                            .toList(),
                    responseBody.path("totalCount").asInt(0),
                    responseBody.path("numOfRows").asInt(PAGE_SIZE),
                    responseBody.path("pageNo").asInt(1));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to parse Tour API response.", exception);
        }
    }

    private TourApiDestination toDestination(JsonNode item) {
        return new TourApiDestination(
                text(item, "contentid"),
                text(item, "title"),
                text(item, "contenttypeid"),
                areaName(text(item, "areacode")),
                text(item, "addr1"),
                defaultText(text(item, "cat3"), defaultText(text(item, "cat2"), text(item, "contenttypeid"))),
                defaultText(text(item, "firstimage"), text(item, "firstimage2")));
    }

    private String text(JsonNode node, String field) {
        return node.path(field).asText("").trim();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private void pauseBetweenRequests() {
        try {
            Thread.sleep(REQUEST_PAUSE_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while throttling Tour API requests.", exception);
        }
    }

    private String areaName(String areaCode) {
        return switch (areaCode) {
            case "1" -> "서울";
            case "2" -> "인천";
            case "3" -> "대전";
            case "4" -> "대구";
            case "5" -> "광주";
            case "6" -> "부산";
            case "7" -> "울산";
            case "8" -> "세종";
            case "31" -> "경기";
            case "32" -> "강원";
            case "33" -> "충북";
            case "34" -> "충남";
            case "35" -> "경북";
            case "36" -> "경남";
            case "37" -> "전북";
            case "38" -> "전남";
            case "39" -> "제주";
            default -> "국내";
        };
    }

    private record TourApiPage(
            List<TourApiDestination> destinations,
            int totalCount,
            int numOfRows,
            int pageNo) {
        static TourApiPage empty() {
            return new TourApiPage(List.of(), 0, PAGE_SIZE, 1);
        }

        boolean isLastPage(int requestedPageSize) {
            int effectiveRows = numOfRows > 0 ? numOfRows : requestedPageSize;
            int effectivePage = Math.max(1, pageNo);
            if (totalCount > 0) {
                return ((effectivePage - 1) * effectiveRows) + destinations.size() >= totalCount;
            }
            return destinations.size() < effectiveRows;
        }
    }
}
