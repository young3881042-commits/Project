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
    private final AuthService authService;

    public LocalTripController(
            LocalTripDestinationService destinationService,
            TourApiSyncService tourApiSyncService,
            TravelPlanService travelPlanService,
            AuthService authService) {
        this.destinationService = destinationService;
        this.tourApiSyncService = tourApiSyncService;
        this.travelPlanService = travelPlanService;
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

    @PostMapping("/destinations/sync/mock")
    public ApiSyncLogResponse syncMockDestinations() {
        return destinationService.syncMockDestinations();
    }

    @PostMapping("/destinations/sync/tour-api")
    public ApiSyncLogResponse syncTourApiDestinations() {
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
}
