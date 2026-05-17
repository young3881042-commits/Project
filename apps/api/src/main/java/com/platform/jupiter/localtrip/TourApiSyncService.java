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
        destination.setName(limit(tourDestination.title(), 120));
        destination.setRegion(limit(tourDestination.areaName(), 40));
        destination.setDistrict("관광지");
        destination.setCategory(limit(defaultText(tourDestination.category(), "관광지"), 80));
        destination.setPrimaryStyle("관광");
        destination.setStyleTags("관광,추천");
        destination.setAddress(limit(defaultText(tourDestination.address(), tourDestination.areaName()), 255));
        destination.setHeadline(limit(tourDestination.title() + " 주변 여행 코스 후보", 255));
        destination.setImageUrl(blankToNull(tourDestination.imageUrl()));
        destination.setDescription(tourDestination.title() + " 정보를 Tour API에서 가져온 추천 관광지입니다.");
        destination.setRecommendedMinutes(90);
        destination.setPopularityScore(70);
        destination.setSource(SOURCE);
        destination.setSourceRef(tourDestination.contentId());
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
