package com.platform.jupiter.foodshow;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class FoodShowAnalyticsService {
    private final JdbcTemplate jdbcTemplate;

    public FoodShowAnalyticsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public FoodShowDashboardResponse dashboard() {
        return new FoodShowDashboardResponse(summary(), shows(), categories(), entries());
    }

    private FoodShowSummary summary() {
        return jdbcTemplate.queryForObject(
                """
                SELECT
                    (SELECT COUNT(*) FROM food_show) AS show_count,
                    (SELECT COALESCE(SUM(official_participant_count), 0) FROM food_show) AS participant_count,
                    (SELECT COUNT(*) FROM food_venue) AS venue_count,
                    (SELECT COUNT(*) FROM food_category) AS category_count,
                    (SELECT COUNT(*) FROM food_venue WHERE location_status = 'RESOLVED') AS resolved_location_count,
                    (SELECT COUNT(*) FROM food_venue WHERE location_status <> 'RESOLVED') AS pending_location_count,
                    (SELECT MAX(updated_at) FROM food_show_entry) AS updated_at
                """,
                (rs, rowNum) -> new FoodShowSummary(
                        rs.getLong("show_count"),
                        rs.getLong("participant_count"),
                        rs.getLong("venue_count"),
                        rs.getLong("category_count"),
                        rs.getLong("resolved_location_count"),
                        rs.getLong("pending_location_count"),
                        asLocalDateTime(rs, "updated_at")));
    }

    private List<FoodShowView> shows() {
        return jdbcTemplate.query(
                """
                SELECT
                    show_item.slug,
                    show_item.title,
                    show_item.subtitle,
                    show_item.network_name,
                    show_item.premiere_label,
                    show_item.official_participant_count,
                    show_item.description,
                    show_item.hero_note,
                    COUNT(entry.id) AS entry_count,
                    COUNT(DISTINCT entry.category_slug) AS category_count
                FROM food_show show_item
                LEFT JOIN food_show_entry entry ON entry.show_slug = show_item.slug
                GROUP BY
                    show_item.slug,
                    show_item.title,
                    show_item.subtitle,
                    show_item.network_name,
                    show_item.premiere_label,
                    show_item.official_participant_count,
                    show_item.description,
                    show_item.hero_note,
                    show_item.sort_order
                ORDER BY show_item.sort_order
                """,
                (rs, rowNum) -> new FoodShowView(
                        rs.getString("slug"),
                        rs.getString("title"),
                        rs.getString("subtitle"),
                        rs.getString("network_name"),
                        rs.getString("premiere_label"),
                        rs.getInt("official_participant_count"),
                        rs.getString("description"),
                        rs.getString("hero_note"),
                        rs.getInt("entry_count"),
                        rs.getInt("category_count")));
    }

    private List<FoodCategoryView> categories() {
        return jdbcTemplate.query(
                """
                SELECT
                    category.slug,
                    category.name,
                    category.description,
                    COUNT(DISTINCT entry.show_slug) AS show_count,
                    COUNT(entry.id) AS entry_count
                FROM food_category category
                LEFT JOIN food_show_entry entry ON entry.category_slug = category.slug
                GROUP BY category.slug, category.name, category.description, category.sort_order
                ORDER BY category.sort_order
                """,
                (rs, rowNum) -> new FoodCategoryView(
                        rs.getString("slug"),
                        rs.getString("name"),
                        rs.getString("description"),
                        rs.getInt("show_count"),
                        rs.getInt("entry_count")));
    }

    private List<FoodShowEntryView> entries() {
        return jdbcTemplate.query(
                """
                SELECT
                    entry.show_slug,
                    show_item.title AS show_title,
                    entry.category_slug,
                    category.name AS category_name,
                    participant.slug AS participant_slug,
                    participant.display_name AS participant_name,
                    participant.persona_label,
                    participant.role_label,
                    participant.one_liner,
                    entry.cuisine_label,
                    venue.slug AS venue_slug,
                    venue.venue_name,
                    venue.venue_type,
                    venue.area_label,
                    venue.road_address,
                    venue.nearest_station,
                    venue.latitude,
                    venue.longitude,
                    entry.signature_item,
                    entry.short_note,
                    entry.program_note,
                    venue.place_url,
                    venue.map_url,
                    venue.reservation_url,
                    venue.reservation_provider,
                    entry.source_url,
                    entry.source_name,
                    entry.source_note,
                    participant.discovery_status,
                    venue.location_status,
                    entry.card_status,
                    entry.sort_order
                FROM food_show_entry entry
                JOIN food_show show_item ON show_item.slug = entry.show_slug
                JOIN food_category category ON category.slug = entry.category_slug
                JOIN food_participant participant ON participant.slug = entry.participant_slug
                JOIN food_venue venue ON venue.slug = entry.venue_slug
                ORDER BY show_item.sort_order, entry.sort_order, participant.display_name
                """,
                (rs, rowNum) -> new FoodShowEntryView(
                        rs.getString("show_slug"),
                        rs.getString("show_title"),
                        rs.getString("category_slug"),
                        rs.getString("category_name"),
                        rs.getString("participant_slug"),
                        rs.getString("participant_name"),
                        rs.getString("persona_label"),
                        rs.getString("role_label"),
                        rs.getString("one_liner"),
                        rs.getString("cuisine_label"),
                        rs.getString("venue_slug"),
                        rs.getString("venue_name"),
                        rs.getString("venue_type"),
                        rs.getString("area_label"),
                        rs.getString("road_address"),
                        rs.getString("nearest_station"),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getString("signature_item"),
                        rs.getString("short_note"),
                        rs.getString("program_note"),
                        rs.getString("place_url"),
                        rs.getString("map_url"),
                        rs.getString("reservation_url"),
                        rs.getString("reservation_provider"),
                        rs.getString("source_url"),
                        rs.getString("source_name"),
                        rs.getString("source_note"),
                        rs.getString("discovery_status"),
                        rs.getString("location_status"),
                        rs.getString("card_status"),
                        rs.getInt("sort_order")));
    }

    private LocalDateTime asLocalDateTime(ResultSet rs, String columnName) throws SQLException {
        var timestamp = rs.getTimestamp(columnName);
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }
}
