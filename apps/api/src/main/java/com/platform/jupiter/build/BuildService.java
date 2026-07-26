package com.platform.jupiter.build;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class BuildService {
    private final AtomicLong sequence = new AtomicLong(1);
    private final CopyOnWriteArrayList<BuildRecordDto> builds = new CopyOnWriteArrayList<>();

    public List<BuildRecordDto> listBuilds() {
        return List.copyOf(builds);
    }

    public BuildRecordDto createBuild(BuildRequest request) {
        BuildRecordDto record = new BuildRecordDto(
                sequence.getAndIncrement(),
                normalize(request.name(), "workspace-build"),
                normalize(request.description(), ""),
                normalize(request.sourcePath(), ""),
                "queued",
                Instant.now());
        builds.add(0, record);
        return record;
    }

    public long countBuilds() {
        return builds.size();
    }

    private String normalize(String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? fallback : trimmed;
    }
}
