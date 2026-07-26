package com.platform.jupiter.web;

public record ServiceLink(
        String name,
        String url,
        String username,
        String password,
        String note) {
}
