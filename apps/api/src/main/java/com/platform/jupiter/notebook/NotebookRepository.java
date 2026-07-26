package com.platform.jupiter.notebook;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotebookRepository extends JpaRepository<NotebookInstance, Long> {
    List<NotebookInstance> findAllByOrderByCreatedAtDesc();

    Optional<NotebookInstance> findBySlug(String slug);
}
