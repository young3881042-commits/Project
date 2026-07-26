package com.platform.jupiter.localtrip;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelPlanItemRepository extends JpaRepository<TravelPlanItem, Long> {
    List<TravelPlanItem> findByTravelPlanIdOrderByDayNumberAscSequenceNumberAsc(Long travelPlanId);

    void deleteByTravelPlanId(Long travelPlanId);
}
