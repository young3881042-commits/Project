package com.platform.jupiter.localtrip;

import com.platform.jupiter.auth.AuthService;
import com.platform.jupiter.auth.AuthSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class LocalTripController {
    private final LocalTripDestinationService destinationService;
    private final TourApiSyncService tourApiSyncService;
    private final TravelPlanService travelPlanService;
    private final LocalTripMapSearchService mapSearchService;
    private final LocalTripRealPlaceService realPlaceService;
    private final AuthService authService;

    public LocalTripController(
            LocalTripDestinationService destinationService,
            TourApiSyncService tourApiSyncService,
            TravelPlanService travelPlanService,
            LocalTripMapSearchService mapSearchService,
            LocalTripRealPlaceService realPlaceService,
            AuthService authService) {
        this.destinationService = destinationService;
        this.tourApiSyncService = tourApiSyncService;
        this.travelPlanService = travelPlanService;
        this.mapSearchService = mapSearchService;
        this.realPlaceService = realPlaceService;
        this.authService = authService;
    }

    @GetMapping("/destinations")
    public List<DestinationResponse> destinations(
            @RequestParam(required = false) String areaCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) String style,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return destinationService.listDestinations(areaCode, keyword, region, style, page, size);
    }

    @GetMapping("/destinations/{id}")
    public DestinationResponse destination(@PathVariable Long id) {
        return destinationService.getDestination(id);
    }

    @PostMapping("/destinations")
    public DestinationResponse createDestination(
            @Valid @RequestBody DestinationUpsertRequest request,
            HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        return destinationService.createDestination(request);
    }

    @PutMapping("/destinations/{id}")
    public DestinationResponse updateDestination(
            @PathVariable Long id,
            @Valid @RequestBody DestinationUpsertRequest request,
            HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        return destinationService.updateDestination(id, request);
    }

    @PostMapping("/destinations/bulk")
    public DestinationBulkUpsertResponse bulkUpsertDestinations(
            @Valid @RequestBody List<@Valid DestinationUpsertRequest> requests,
            HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        return destinationService.bulkUpsertDestinations(requests);
    }

    @DeleteMapping("/destinations/{id}")
    public ResponseEntity<Void> deleteDestination(@PathVariable Long id, HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        destinationService.deleteDestination(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/maps/places")
    public List<MapPlaceResponse> mapPlaces(
            @RequestParam String query,
            @RequestParam(required = false) Integer size,
            HttpServletRequest servletRequest) {
        authService.requireSession(servletRequest);
        return mapSearchService.search(query, size);
    }

    @GetMapping("/travel-plans/real-places")
    public List<RealLocalPlaceResponse> realPlaces(
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "식당") String style,
            @RequestParam(required = false) String anchor,
            @RequestParam(required = false) Integer size,
            HttpServletRequest servletRequest) {
        authService.requireSession(servletRequest);
        return realPlaceService.suggestFoodPlaces(region, style, anchor, size);
    }

    @PostMapping("/destinations/sync/mock")
    public ApiSyncLogResponse syncMockDestinations(HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        return destinationService.syncMockDestinations();
    }

    @PostMapping("/destinations/sync/tour-api")
    public ApiSyncLogResponse syncTourApiDestinations(HttpServletRequest servletRequest) {
        requireAdmin(servletRequest);
        return tourApiSyncService.syncDestinations();
    }

    @PostMapping("/travel-plans/generate")
    public TravelPlanResponse generateTravelPlan(
            @Valid @RequestBody TravelPlanGenerateRequest request,
            HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return travelPlanService.generate(request, session.username());
    }

    @GetMapping("/travel-plans")
    public List<TravelPlanResponse> travelPlans(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return travelPlanService.listPlans(session.username());
    }

    @GetMapping("/travel-plans/{id}")
    public TravelPlanResponse travelPlan(@PathVariable Long id, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        return travelPlanService.getPlan(id, session.username());
    }

    @DeleteMapping("/travel-plans/{id}")
    public ResponseEntity<Void> deleteTravelPlan(@PathVariable Long id, HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        travelPlanService.deletePlan(id, session.username());
        return ResponseEntity.noContent().build();
    }

    private AuthSession requireAdmin(HttpServletRequest servletRequest) {
        AuthSession session = authService.requireSession(servletRequest);
        if (!session.admin()) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "Admin access required");
        }
        return session;
    }
}
