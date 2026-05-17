package com.platform.jupiter.localtrip;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TourApiSyncService {
    private static final String SOURCE = "tour-api";

    private final TourApiProperties properties;
    private final TourApiService tourApiService;
    private final ApiSyncLogRepository syncLogRepository;
    private final LocalTripSchemaService schemaService;
    private final DestinationRepository destinationRepository;

    public TourApiSyncService(
            TourApiProperties properties,
            TourApiService tourApiService,
            ApiSyncLogRepository syncLogRepository,
            LocalTripSchemaService schemaService,
            DestinationRepository destinationRepository) {
        this.properties = properties;
        this.tourApiService = tourApiService;
        this.syncLogRepository = syncLogRepository;
        this.schemaService = schemaService;
        this.destinationRepository = destinationRepository;
    }

    @Transactional
    public ApiSyncLogResponse syncDestinations() {
        schemaService.ensureSchema();
        Instant startedAt = Instant.now();
        ApiSyncLog log = new ApiSyncLog();
        log.setProvider(SOURCE);
        log.setSyncType("DESTINATION");
        log.setRecordsInserted(0);
        log.setRecordsUpdated(0);
        log.setRequestUrl(properties.baseUrlOrDefault());
        log.setStartedAt(startedAt);

        if (!properties.hasServiceKey()) {
            log.setStatus("SKIPPED");
            log.setMessage("Tour API service key is not configured; external sync skipped.");
            log.setEndedAt(Instant.now());
            return ApiSyncLogResponse.from(syncLogRepository.save(log));
        }

        try {
            List<TourApiDestination> destinations = tourApiService.fetchDestinations();
            int inserted = 0;
            int updated = 0;
            for (TourApiDestination tourDestination : destinations) {
                Destination destination = destinationRepository
                        .findBySourceAndSourceRef(SOURCE, tourDestination.contentId())
                        .orElseGet(Destination::new);
                boolean isNew = destination.getId() == null;
                applyTourDestination(destination, tourDestination);
                destinationRepository.save(destination);
                if (isNew) {
                    inserted++;
                } else {
                    updated++;
                }
            }
            log.setStatus("SUCCEEDED");
            log.setRecordsInserted(inserted);
            log.setRecordsUpdated(updated);
            log.setMessage("Tour API sync completed with " + destinations.size() + " parsed records.");
        } catch (RuntimeException exception) {
            log.setStatus("FAILED");
            log.setMessage("Tour API sync failed.");
            log.setErrorDetail(stackTrace(exception));
        }

        log.setEndedAt(Instant.now());
        return ApiSyncLogResponse.from(syncLogRepository.save(log));
    }

    private String stackTrace(RuntimeException exception) {
        StringWriter writer = new StringWriter();
        exception.printStackTrace(new PrintWriter(writer));
        return writer.toString();
    }

    private void applyTourDestination(Destination destination, TourApiDestination tourDestination) {
        boolean food = "39".equals(tourDestination.contentTypeId());
        boolean cafe = food && isCafeLike(tourDestination);
        String placeStyle = cafe ? "카페" : "식당";
        destination.setName(limit(tourDestination.title(), 120));
        destination.setRegion(limit(tourDestination.areaName(), 40));
        destination.setDistrict(food ? "위치정보" : "관광지");
        destination.setCategory(food ? placeStyle : limit(defaultText(tourDestination.category(), "관광지"), 80));
        destination.setPrimaryStyle(food ? placeStyle : "관광");
        destination.setStyleTags(food ? placeStyle + ",위치정보,TourAPI" : "관광,추천,TourAPI");
        destination.setAddress(limit(defaultText(tourDestination.address(), tourDestination.areaName()), 255));
        destination.setHeadline(food
                ? limit(tourDestination.title() + " 위치 정보", 255)
                : limit(tourDestination.title() + " 주변 여행 코스 후보", 255));
        destination.setImageUrl(food ? null : blankToNull(tourDestination.imageUrl()));
        destination.setDescription(food
                ? "TourAPI에서 가져온 식당 위치 정보입니다. 추천 판단에는 위치와 동선만 사용합니다."
                : tourDestination.title() + " 정보를 TourAPI에서 가져온 추천 관광지입니다.");
        destination.setRecommendedMinutes(food ? 70 : 90);
        destination.setPopularityScore(food ? 55 : 70);
        destination.setSource(SOURCE);
        destination.setSourceRef(tourDestination.contentId());
    }

    private boolean isCafeLike(TourApiDestination destination) {
        String text = defaultText(destination.title(), "") + " "
                + defaultText(destination.category(), "") + " "
                + defaultText(destination.address(), "");
        return text.matches(".*(카페|커피|coffee|cafe|디저트|베이커리|찻집|다방|tea|티하우스).*");
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String limit(String value, int maxLength) {
        String normalized = defaultText(value, "");
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }
}
