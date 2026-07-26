package com.platform.jupiter.localtrip;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DestinationRepository extends JpaRepository<Destination, Long> {
    List<Destination> findAllByOrderByRegionAscPopularityScoreDescNameAsc();

    long countBySource(String source);

    Optional<Destination> findBySourceAndSourceRef(String source, String sourceRef);
}
