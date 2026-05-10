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
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class LocalTripController {
    private static final String DEFAULT_GENERATION_USERNAME = "admin";

    private final LocalTripDestinationService destinationService;
    private final TravelPlanService travelPlanService;
    private final AuthService authService;

    public LocalTripController(
            LocalTripDestinationService destinationService,
            TravelPlanService travelPlanService,
            AuthService authService) {
        this.destinationService = destinationService;
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

    @PostMapping("/travel-plans/generate")
    public TravelPlanResponse generateTravelPlan(
            @Valid @RequestBody TravelPlanGenerateRequest request,
            HttpServletRequest servletRequest) {
        return travelPlanService.generate(request, resolveGenerationUsername(servletRequest));
    }

    @GetMapping("/travel-plans")
    public List<TravelPlanResponse> travelPlans() {
        return travelPlanService.listPlans();
    }

    @GetMapping("/travel-plans/{id}")
    public TravelPlanResponse travelPlan(@PathVariable Long id) {
        return travelPlanService.getPlan(id);
    }

    @DeleteMapping("/travel-plans/{id}")
    public ResponseEntity<Void> deleteTravelPlan(@PathVariable Long id) {
        travelPlanService.deletePlan(id);
        return ResponseEntity.noContent().build();
    }

    private String resolveGenerationUsername(HttpServletRequest servletRequest) {
        try {
            AuthSession session = authService.requireSession(servletRequest);
            return session.username();
        } catch (ResponseStatusException ignored) {
            return DEFAULT_GENERATION_USERNAME;
        }
    }
}
