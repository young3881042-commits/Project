CREATE TABLE IF NOT EXISTS build_records (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    image_tag VARCHAR(64) NOT NULL UNIQUE,
    image_name VARCHAR(255) NOT NULL,
    job_name VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL,
    pip_packages VARCHAR(255),
    note TEXT,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS notebook_instances (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    image_tag VARCHAR(64) NOT NULL,
    image_name VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    deployment_name VARCHAR(128) NOT NULL UNIQUE,
    service_name VARCHAR(128) NOT NULL UNIQUE,
    access_url VARCHAR(255) NOT NULL,
    access_token VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_user_account (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS app_auth_schema_state (
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    version INT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_region (
    region_code VARCHAR(16) NOT NULL PRIMARY KEY,
    region_name VARCHAR(80) NOT NULL,
    region_group VARCHAR(40) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_district (
    district_code VARCHAR(24) NOT NULL PRIMARY KEY,
    region_code VARCHAR(16) NOT NULL,
    district_name VARCHAR(80) NOT NULL,
    district_tier VARCHAR(40) NOT NULL,
    sort_order INT NOT NULL,
    CONSTRAINT fk_travel_district_region FOREIGN KEY (region_code) REFERENCES travel_region(region_code)
);

CREATE TABLE IF NOT EXISTS travel_place (
    place_id VARCHAR(32) NOT NULL PRIMARY KEY,
    district_code VARCHAR(24) NOT NULL,
    place_name VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    address VARCHAR(255) NOT NULL,
    headline VARCHAR(255) NOT NULL,
    tags_json TEXT NOT NULL,
    rating DECIMAL(3, 2) NOT NULL,
    review_count INT NOT NULL,
    source_ref VARCHAR(64) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_travel_place_district FOREIGN KEY (district_code) REFERENCES travel_district(district_code)
);

CREATE TABLE IF NOT EXISTS travel_place_source_snapshot (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    snapshot_time TIMESTAMP(6) NOT NULL,
    district_code VARCHAR(24) NOT NULL,
    place_id VARCHAR(32) NOT NULL,
    visit_count INT NOT NULL,
    search_count INT NOT NULL,
    booking_count INT NOT NULL,
    stay_minutes INT NOT NULL,
    occupancy_rate DECIMAL(5, 2) NOT NULL,
    foreign_visitor_count INT NOT NULL,
    local_visitor_count INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_place_source_snapshot UNIQUE (snapshot_time, place_id),
    CONSTRAINT fk_travel_place_source_snapshot_district FOREIGN KEY (district_code) REFERENCES travel_district(district_code),
    CONSTRAINT fk_travel_place_source_snapshot_place FOREIGN KEY (place_id) REFERENCES travel_place(place_id)
);

CREATE TABLE IF NOT EXISTS travel_district_live_metric (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    metric_timestamp TIMESTAMP(6) NOT NULL,
    district_code VARCHAR(24) NOT NULL,
    visitor_count INT NOT NULL,
    search_count INT NOT NULL,
    booking_count INT NOT NULL,
    avg_stay_minutes INT NOT NULL,
    occupancy_rate DECIMAL(5, 2) NOT NULL,
    foreign_visitor_count INT NOT NULL,
    local_visitor_count INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_district_live_metric UNIQUE (metric_timestamp, district_code),
    CONSTRAINT fk_travel_district_live_metric_district FOREIGN KEY (district_code) REFERENCES travel_district(district_code)
);

CREATE TABLE IF NOT EXISTS travel_place_live_metric (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    metric_timestamp TIMESTAMP(6) NOT NULL,
    place_id VARCHAR(32) NOT NULL,
    visitor_count INT NOT NULL,
    search_count INT NOT NULL,
    booking_count INT NOT NULL,
    avg_stay_minutes INT NOT NULL,
    occupancy_rate DECIMAL(5, 2) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_place_live_metric UNIQUE (metric_timestamp, place_id),
    CONSTRAINT fk_travel_place_live_metric_place FOREIGN KEY (place_id) REFERENCES travel_place(place_id)
);

CREATE TABLE IF NOT EXISTS travel_district_daily_summary (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    stat_date DATE NOT NULL,
    district_code VARCHAR(24) NOT NULL,
    visitor_count INT NOT NULL,
    search_count INT NOT NULL,
    booking_count INT NOT NULL,
    avg_stay_minutes INT NOT NULL,
    occupancy_rate DECIMAL(5, 2) NOT NULL,
    yoy_change_rate DECIMAL(5, 2) NOT NULL,
    foreign_visitor_count INT NOT NULL,
    local_visitor_count INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_district_daily_summary UNIQUE (stat_date, district_code),
    CONSTRAINT fk_travel_district_daily_summary_district FOREIGN KEY (district_code) REFERENCES travel_district(district_code)
);

CREATE TABLE IF NOT EXISTS batch_job_definition (
    job_key VARCHAR(64) NOT NULL PRIMARY KEY,
    job_name VARCHAR(120) NOT NULL,
    schedule_type VARCHAR(16) NOT NULL,
    cron_expression VARCHAR(64) NOT NULL,
    notebook_path VARCHAR(255) NOT NULL,
    python_entrypoint VARCHAR(255) NOT NULL,
    source_name VARCHAR(80) NOT NULL,
    target_table VARCHAR(80) NOT NULL,
    elk_index VARCHAR(80) NOT NULL,
    description TEXT NOT NULL,
    is_active BIT NOT NULL DEFAULT b'1',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS batch_run (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    run_key VARCHAR(64) NOT NULL UNIQUE,
    job_key VARCHAR(64) NOT NULL,
    run_mode VARCHAR(16) NOT NULL,
    trigger_type VARCHAR(16) NOT NULL,
    notebook_instance VARCHAR(80) NOT NULL,
    source_name VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL,
    records_in INT NOT NULL DEFAULT 0,
    records_out INT NOT NULL DEFAULT 0,
    duration_ms BIGINT,
    summary_message VARCHAR(255),
    elk_trace_id VARCHAR(80),
    started_at TIMESTAMP(6) NOT NULL,
    ended_at TIMESTAMP(6),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_batch_run_job_key FOREIGN KEY (job_key) REFERENCES batch_job_definition(job_key)
);

CREATE TABLE IF NOT EXISTS batch_run_event (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_run_id BIGINT NOT NULL,
    event_time TIMESTAMP(6) NOT NULL,
    log_level VARCHAR(16) NOT NULL,
    step_name VARCHAR(64) NOT NULL,
    message VARCHAR(255) NOT NULL,
    payload_json TEXT,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_batch_run_event_run FOREIGN KEY (batch_run_id) REFERENCES batch_run(id)
);

CREATE TABLE IF NOT EXISTS travel_live_metric (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    metric_timestamp TIMESTAMP(6) NOT NULL,
    region_code VARCHAR(16) NOT NULL,
    visitor_count INT NOT NULL,
    search_count INT NOT NULL,
    booking_count INT NOT NULL,
    revenue_amount DECIMAL(14, 2) NOT NULL,
    foreign_visitor_count INT NOT NULL,
    local_visitor_count INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_live_metric UNIQUE (metric_timestamp, region_code),
    CONSTRAINT fk_travel_live_metric_region FOREIGN KEY (region_code) REFERENCES travel_region(region_code)
);

CREATE TABLE IF NOT EXISTS travel_daily_summary (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    stat_date DATE NOT NULL,
    region_code VARCHAR(16) NOT NULL,
    visitor_count INT NOT NULL,
    booking_count INT NOT NULL,
    revenue_amount DECIMAL(14, 2) NOT NULL,
    avg_stay_minutes INT NOT NULL,
    hotel_occupancy_rate DECIMAL(5, 2) NOT NULL,
    yoy_change_rate DECIMAL(5, 2) NOT NULL,
    foreign_visitor_count INT NOT NULL,
    local_visitor_count INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT uk_travel_daily_summary UNIQUE (stat_date, region_code),
    CONSTRAINT fk_travel_daily_summary_region FOREIGN KEY (region_code) REFERENCES travel_region(region_code)
);

CREATE INDEX IF NOT EXISTS idx_batch_run_job_started_at ON batch_run(job_key, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_run_status_started_at ON batch_run(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_run_event_run_time ON batch_run_event(batch_run_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_travel_live_metric_timestamp ON travel_live_metric(metric_timestamp DESC, region_code);
CREATE INDEX IF NOT EXISTS idx_travel_daily_summary_date ON travel_daily_summary(stat_date DESC, region_code);
CREATE INDEX IF NOT EXISTS idx_travel_district_region_sort ON travel_district(region_code, sort_order);
CREATE INDEX IF NOT EXISTS idx_travel_place_district_category ON travel_place(district_code, category);
CREATE INDEX IF NOT EXISTS idx_travel_place_source_snapshot_time ON travel_place_source_snapshot(snapshot_time DESC, district_code);
CREATE INDEX IF NOT EXISTS idx_travel_district_live_metric_time ON travel_district_live_metric(metric_timestamp DESC, district_code);
CREATE INDEX IF NOT EXISTS idx_travel_place_live_metric_time ON travel_place_live_metric(metric_timestamp DESC, place_id);
CREATE INDEX IF NOT EXISTS idx_travel_district_daily_summary_date ON travel_district_daily_summary(stat_date DESC, district_code);

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
);

CREATE TABLE IF NOT EXISTS localtrip_travel_plan (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL DEFAULT 'admin',
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
);

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
);

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
);

CREATE INDEX IF NOT EXISTS idx_localtrip_destination_region_style ON localtrip_destination(region, primary_style);
CREATE INDEX IF NOT EXISTS idx_localtrip_plan_username_created_at ON localtrip_travel_plan(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_localtrip_plan_created_at ON localtrip_travel_plan(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_localtrip_plan_item_plan ON localtrip_travel_plan_item(travel_plan_id, day_number, sequence_number);
CREATE INDEX IF NOT EXISTS idx_localtrip_sync_log_created_at ON localtrip_api_sync_log(created_at DESC);

CREATE TABLE IF NOT EXISTS food_show (
    slug VARCHAR(64) NOT NULL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    subtitle VARCHAR(160) NOT NULL,
    network_name VARCHAR(80) NOT NULL,
    premiere_label VARCHAR(80) NOT NULL,
    official_participant_count INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    hero_note VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS food_category (
    slug VARCHAR(64) NOT NULL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS food_participant (
    slug VARCHAR(64) NOT NULL PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    persona_label VARCHAR(80) NOT NULL,
    role_label VARCHAR(80) NOT NULL,
    one_liner VARCHAR(255) NOT NULL,
    discovery_status VARCHAR(24) NOT NULL DEFAULT 'DISCOVERED',
    discovery_source_name VARCHAR(120),
    discovery_source_url VARCHAR(255),
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS food_venue (
    slug VARCHAR(64) NOT NULL PRIMARY KEY,
    venue_name VARCHAR(120) NOT NULL,
    venue_type VARCHAR(60) NOT NULL,
    area_label VARCHAR(120) NOT NULL,
    road_address VARCHAR(255),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    nearest_station VARCHAR(120),
    place_url VARCHAR(255),
    map_url VARCHAR(255),
    reservation_url VARCHAR(255),
    reservation_provider VARCHAR(40),
    source_url VARCHAR(255) NOT NULL,
    source_name VARCHAR(120) NOT NULL,
    highlight_note VARCHAR(255) NOT NULL,
    location_status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS food_show_entry (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    show_slug VARCHAR(64) NOT NULL,
    category_slug VARCHAR(64) NOT NULL,
    participant_slug VARCHAR(64) NOT NULL,
    venue_slug VARCHAR(64) NOT NULL,
    cuisine_label VARCHAR(80) NOT NULL,
    signature_item VARCHAR(160) NOT NULL,
    short_note VARCHAR(255) NOT NULL,
    program_note VARCHAR(255) NOT NULL,
    source_name VARCHAR(120) NOT NULL,
    source_url VARCHAR(255) NOT NULL,
    source_note VARCHAR(255) NOT NULL,
    card_status VARCHAR(24) NOT NULL DEFAULT 'READY',
    sort_order INT NOT NULL,
    featured BIT NOT NULL DEFAULT b'1',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_food_show_entry_show FOREIGN KEY (show_slug) REFERENCES food_show(slug),
    CONSTRAINT fk_food_show_entry_category FOREIGN KEY (category_slug) REFERENCES food_category(slug),
    CONSTRAINT fk_food_show_entry_participant FOREIGN KEY (participant_slug) REFERENCES food_participant(slug),
    CONSTRAINT fk_food_show_entry_venue FOREIGN KEY (venue_slug) REFERENCES food_venue(slug),
    CONSTRAINT uk_food_show_entry UNIQUE (show_slug, participant_slug, venue_slug)
);

CREATE INDEX IF NOT EXISTS idx_food_show_sort ON food_show(sort_order);
CREATE INDEX IF NOT EXISTS idx_food_category_sort ON food_category(sort_order);
CREATE INDEX IF NOT EXISTS idx_food_entry_show_sort ON food_show_entry(show_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_food_entry_category_sort ON food_show_entry(category_slug, sort_order);

ALTER TABLE food_show ADD COLUMN IF NOT EXISTS official_participant_count INT NOT NULL DEFAULT 0;
ALTER TABLE food_participant ADD COLUMN IF NOT EXISTS discovery_status VARCHAR(24) NOT NULL DEFAULT 'DISCOVERED';
ALTER TABLE food_participant ADD COLUMN IF NOT EXISTS discovery_source_name VARCHAR(120);
ALTER TABLE food_participant ADD COLUMN IF NOT EXISTS discovery_source_url VARCHAR(255);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS road_address VARCHAR(255);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS nearest_station VARCHAR(120);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS map_url VARCHAR(255);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS reservation_url VARCHAR(255);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS reservation_provider VARCHAR(40);
ALTER TABLE food_venue ADD COLUMN IF NOT EXISTS location_status VARCHAR(24) NOT NULL DEFAULT 'PENDING';
ALTER TABLE food_show_entry ADD COLUMN IF NOT EXISTS card_status VARCHAR(24) NOT NULL DEFAULT 'READY';
ALTER TABLE food_venue MODIFY COLUMN map_url VARCHAR(1024);
ALTER TABLE food_venue MODIFY COLUMN place_url VARCHAR(1024);
