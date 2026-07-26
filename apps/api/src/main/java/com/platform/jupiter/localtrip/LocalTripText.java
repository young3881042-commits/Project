package com.platform.jupiter.localtrip;

import java.util.Arrays;
import java.util.List;

final class LocalTripText {
    private LocalTripText() {
    }

    static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    static List<String> splitCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .toList();
    }
}
