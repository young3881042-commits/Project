package com.platform.jupiter.localtrip;

import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class LocalTripSchemaService {
    private final JdbcTemplate jdbcTemplate;
    private final AtomicBoolean initialized = new AtomicBoolean(false);

    public LocalTripSchemaService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void ensureSchema() {
        if (initialized.get()) {
            return;
        }
        synchronized (this) {
            if (initialized.get()) {
                return;
            }
            createTables();
            initialized.set(true);
        }
    }

    private void createTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS localtrip_destination (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(120) NOT NULL,
                    region VARCHAR(40) NOT NULL,
                    district VARCHAR(80) NOT NULL,
                    category VARCHAR(80) NOT NULL,
                    primary_style VARCHAR(40) NOT NULL,
                    style_tags VARCHAR(255) NOT NULL,
                    address VARCHAR(255) NOT NULL,
                    headline VARCHAR(255) NOT NULL,
                    image_url VARCHAR(512),
                    description TEXT NOT NULL,
                    recommended_minutes INT NOT NULL,
                    popularity_score INT NOT NULL,
                    source VARCHAR(40) NOT NULL,
                    source_ref VARCHAR(80) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    CONSTRAINT uk_localtrip_destination_source_ref UNIQUE (source, source_ref)
                )
                """);
        jdbcTemplate.execute("ALTER TABLE localtrip_destination ADD COLUMN IF NOT EXISTS image_url VARCHAR(512)");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS localtrip_travel_plan (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(160) NOT NULL,
                    region VARCHAR(120) NOT NULL,
                    styles VARCHAR(255) NOT NULL,
                    days INT NOT NULL,
                    traveler_count INT NOT NULL,
                    traveler_type VARCHAR(40) NOT NULL,
                    pace VARCHAR(40) NOT NULL,
                    summary VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS localtrip_travel_plan_item (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    travel_plan_id BIGINT NOT NULL,
                    destination_id BIGINT,
                    day_number INT NOT NULL,
                    sequence_number INT NOT NULL,
                    time_slot VARCHAR(40) NOT NULL,
                    destination_name VARCHAR(120) NOT NULL,
                    region VARCHAR(40) NOT NULL,
                    primary_style VARCHAR(40) NOT NULL,
                    note VARCHAR(255) NOT NULL,
                    duration_minutes INT NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    CONSTRAINT fk_localtrip_plan_item_plan FOREIGN KEY (travel_plan_id) REFERENCES localtrip_travel_plan(id) ON DELETE CASCADE,
                    CONSTRAINT fk_localtrip_plan_item_destination FOREIGN KEY (destination_id) REFERENCES localtrip_destination(id) ON DELETE SET NULL
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS localtrip_api_sync_log (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    provider VARCHAR(40) NOT NULL,
                    sync_type VARCHAR(40) NOT NULL,
                    status VARCHAR(24) NOT NULL,
                    records_inserted INT NOT NULL,
                    records_updated INT NOT NULL,
                    request_url VARCHAR(255),
                    message VARCHAR(255) NOT NULL,
                    error_detail TEXT,
                    started_at TIMESTAMP(6) NOT NULL,
                    ended_at TIMESTAMP(6) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
                )
                """);
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_localtrip_destination_region_style ON localtrip_destination(region, primary_style)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_localtrip_plan_created_at ON localtrip_travel_plan(created_at DESC)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_localtrip_plan_item_plan ON localtrip_travel_plan_item(travel_plan_id, day_number, sequence_number)");
        jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_localtrip_sync_log_created_at ON localtrip_api_sync_log(created_at DESC)");
    }
}
