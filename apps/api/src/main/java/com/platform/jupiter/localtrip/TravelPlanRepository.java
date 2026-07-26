package com.platform.jupiter.localtrip;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelPlanRepository extends JpaRepository<TravelPlan, Long> {
    List<TravelPlan> findAllByOrderByCreatedAtDesc();
    List<TravelPlan> findAllByUsernameOrderByCreatedAtDesc(String username);
}
