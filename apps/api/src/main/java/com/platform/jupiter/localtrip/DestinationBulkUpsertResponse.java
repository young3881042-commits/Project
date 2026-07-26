package com.platform.jupiter.localtrip;

import java.util.List;

public record DestinationBulkUpsertResponse(
        int inserted,
        int updated,
        int total,
        List<DestinationResponse> destinations) {
}
