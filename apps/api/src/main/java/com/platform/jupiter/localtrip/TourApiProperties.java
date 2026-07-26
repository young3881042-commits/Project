package com.platform.jupiter.localtrip;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.tour-api")
public record TourApiProperties(String baseUrl, String serviceKey) {
    private static final String DEFAULT_BASE_URL = "https://apis.data.go.kr/B551011/KorService2";

    public String baseUrlOrDefault() {
        return baseUrl == null || baseUrl.isBlank() ? DEFAULT_BASE_URL : baseUrl.trim();
    }

    public boolean hasServiceKey() {
        return serviceKey != null && !serviceKey.isBlank();
    }
}
