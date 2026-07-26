package com.platform.jupiter.localtrip;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TourApiService {
    private final TourApiClient tourApiClient;

    public TourApiService(TourApiClient tourApiClient) {
        this.tourApiClient = tourApiClient;
    }

    public List<TourApiDestination> fetchDestinations() {
        return tourApiClient.fetchAreaBasedDestinations();
    }
}
