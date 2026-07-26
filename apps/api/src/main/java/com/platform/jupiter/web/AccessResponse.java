package com.platform.jupiter.web;

import java.util.List;

public record AccessResponse(
        List<ServiceLink> services,
        List<DocLink> documents) {
}
