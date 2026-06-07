package com.platform.jupiter.travel;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class TravelAnalyticsService {
    private final JdbcTemplate jdbcTemplate;

    public TravelAnalyticsService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public TravelDashboardResponse dashboard() {
        return new TravelDashboardResponse(
                summary(),
                regions(),
                districts(),
                places(),
                trends(),
                jobs(),
                recentRuns(),
                recentEvents());
    }

    private TravelSummary summary() {
        LocalDateTime liveTimestamp = jdbcTemplate.queryForObject(
                "SELECT MAX(metric_timestamp) AS live_timestamp FROM travel_district_live_metric",
                (rs, rowNum) -> asLocalDateTime(rs, "live_timestamp"));
        LocalDate latestStatDate = jdbcTemplate.queryForObject(
                "SELECT MAX(stat_date) AS latest_stat_date FROM travel_district_daily_summary",
                (rs, rowNum) -> {
                    java.sql.Date date = rs.getDate("latest_stat_date");
                    return date == null ? null : date.toLocalDate();
                });

        SummaryRow row = jdbcTemplate.queryForObject(
                """
                SELECT
                    COALESCE(SUM(visitor_count), 0) AS total_visitors,
                    COALESCE(SUM(search_count), 0) AS total_searches,
                    COALESCE(SUM(booking_count), 0) AS total_bookings,
                    COALESCE(SUM(foreign_visitor_count), 0) AS foreign_visitors,
                    COALESCE(SUM(local_visitor_count), 0) AS local_visitors
                FROM travel_district_daily_summary
                WHERE stat_date = (SELECT MAX(stat_date) FROM travel_district_daily_summary)
                """,
                (rs, rowNum) -> new SummaryRow(
                        rs.getLong("total_visitors"),
                        rs.getLong("total_searches"),
                        rs.getLong("total_bookings"),
                        rs.getLong("foreign_visitors"),
                        rs.getLong("local_visitors")));

        Long activeBatchRuns = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM batch_run WHERE status = 'RUNNING'",
                Long.class);
        Long districtCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM travel_district", Long.class);
        Long placeCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM travel_place", Long.class);

        long visitorBase = row.foreignVisitors() + row.localVisitors();
        BigDecimal share = visitorBase == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(row.foreignVisitors() * 100.0 / visitorBase).setScale(2, RoundingMode.HALF_UP);

        return new TravelSummary(
                liveTimestamp,
                latestStatDate,
                row.totalVisitors(),
                row.totalSearches(),
                row.totalBookings(),
                share,
                activeBatchRuns == null ? 0 : activeBatchRuns,
                districtCount == null ? 0 : districtCount,
                placeCount == null ? 0 : placeCount);
    }

    private List<RegionPerformance> regions() {
        return jdbcTemplate.query(
                """
                SELECT
                    r.region_code,
                    r.region_name,
                    r.region_group,
                    COALESCE(SUM(dl.search_count), 0) AS live_searches,
                    COALESCE(SUM(dl.booking_count), 0) AS live_bookings,
                    COALESCE(SUM(dd.visitor_count), 0) AS daily_visitors,
                    COUNT(DISTINCT d.district_code) AS district_count,
                    COALESCE(AVG(dd.occupancy_rate), 0) AS occupancy_rate,
                    COALESCE(AVG(dd.yoy_change_rate), 0) AS yoy_change_rate
                FROM travel_region r
                JOIN travel_district d ON d.region_code = r.region_code
                LEFT JOIN travel_district_live_metric dl
                    ON dl.district_code = d.district_code
                    AND dl.metric_timestamp = (SELECT MAX(metric_timestamp) FROM travel_district_live_metric)
                LEFT JOIN travel_district_daily_summary dd
                    ON dd.district_code = d.district_code
                    AND dd.stat_date = (SELECT MAX(stat_date) FROM travel_district_daily_summary)
                GROUP BY r.region_code, r.region_name, r.region_group, r.sort_order
                ORDER BY r.sort_order
                """,
                (rs, rowNum) -> new RegionPerformance(
                        rs.getString("region_code"),
                        rs.getString("region_name"),
                        rs.getString("region_group"),
                        rs.getLong("live_searches"),
                        rs.getLong("live_bookings"),
                        rs.getLong("daily_visitors"),
                        rs.getInt("district_count"),
                        rs.getBigDecimal("occupancy_rate"),
                        rs.getBigDecimal("yoy_change_rate")));
    }

    private List<DistrictPerformance> districts() {
        return jdbcTemplate.query(
                """
                SELECT
                    r.region_code,
                    r.region_name,
                    r.region_group,
                    d.district_code,
                    d.district_name,
                    d.district_tier,
                    COALESCE(dl.search_count, 0) AS live_searches,
                    COALESCE(dl.booking_count, 0) AS live_bookings,
                    COUNT(DISTINCT p.place_id) AS place_count,
                    COALESCE(dd.avg_stay_minutes, COALESCE(dl.avg_stay_minutes, 0)) AS avg_stay_minutes,
                    COALESCE(dd.occupancy_rate, COALESCE(dl.occupancy_rate, 0)) AS occupancy_rate,
                    COALESCE(dd.yoy_change_rate, 0) AS yoy_change_rate,
                    CASE
                        WHEN COALESCE(dd.foreign_visitor_count, dl.foreign_visitor_count, 0) + COALESCE(dd.local_visitor_count, dl.local_visitor_count, 0) = 0
                            THEN 0
                        ELSE ROUND(
                            COALESCE(dd.foreign_visitor_count, dl.foreign_visitor_count, 0) * 100.0 /
                            (COALESCE(dd.foreign_visitor_count, dl.foreign_visitor_count, 0) + COALESCE(dd.local_visitor_count, dl.local_visitor_count, 0)),
                            2
                        )
                    END AS foreign_share
                FROM travel_district d
                JOIN travel_region r ON r.region_code = d.region_code
                LEFT JOIN travel_district_live_metric dl
                    ON dl.district_code = d.district_code
                    AND dl.metric_timestamp = (SELECT MAX(metric_timestamp) FROM travel_district_live_metric)
                LEFT JOIN travel_district_daily_summary dd
                    ON dd.district_code = d.district_code
                    AND dd.stat_date = (SELECT MAX(stat_date) FROM travel_district_daily_summary)
                LEFT JOIN travel_place p ON p.district_code = d.district_code
                GROUP BY
                    r.region_code, r.region_name, r.region_group,
                    d.district_code, d.district_name, d.district_tier, d.sort_order,
                    dl.visitor_count, dl.search_count, dl.booking_count, dl.avg_stay_minutes, dl.occupancy_rate,
                    dl.foreign_visitor_count, dl.local_visitor_count,
                    dd.avg_stay_minutes, dd.occupancy_rate, dd.yoy_change_rate, dd.foreign_visitor_count, dd.local_visitor_count
                ORDER BY r.sort_order, d.sort_order
                """,
                (rs, rowNum) -> new DistrictPerformance(
                        rs.getString("region_code"),
                        rs.getString("region_name"),
                        rs.getString("region_group"),
                        rs.getString("district_code"),
                        rs.getString("district_name"),
                        rs.getString("district_tier"),
                        rs.getLong("live_searches"),
                        rs.getLong("live_bookings"),
                        rs.getInt("place_count"),
                        rs.getInt("avg_stay_minutes"),
                        rs.getBigDecimal("occupancy_rate"),
                        rs.getBigDecimal("yoy_change_rate"),
                        rs.getBigDecimal("foreign_share")));
    }

    private List<PlaceSnapshot> places() {
        return jdbcTemplate.query(
                """
                SELECT
                    p.place_id,
                    r.region_code,
                    r.region_name,
                    d.district_code,
                    d.district_name,
                    p.place_name,
                    p.category,
                    p.address,
                    p.headline,
                    p.tags_json,
                    COALESCE(pl.search_count, 0) AS live_searches,
                    COALESCE(pl.booking_count, 0) AS live_bookings,
                    COALESCE(pl.avg_stay_minutes, 0) AS avg_stay_minutes,
                    COALESCE(pl.occupancy_rate, 0) AS occupancy_rate
                FROM travel_place p
                JOIN travel_district d ON d.district_code = p.district_code
                JOIN travel_region r ON r.region_code = d.region_code
                LEFT JOIN travel_place_live_metric pl
                    ON pl.place_id = p.place_id
                    AND pl.metric_timestamp = (SELECT MAX(metric_timestamp) FROM travel_place_live_metric)
                ORDER BY pl.booking_count DESC, pl.visitor_count DESC, p.place_name
                LIMIT 24
                """,
                (rs, rowNum) -> new PlaceSnapshot(
                        rs.getString("place_id"),
                        rs.getString("region_code"),
                        rs.getString("region_name"),
                        rs.getString("district_code"),
                        rs.getString("district_name"),
                        rs.getString("place_name"),
                        rs.getString("category"),
                        rs.getString("address"),
                        rs.getString("headline"),
                        rs.getString("tags_json"),
                        rs.getLong("live_searches"),
                        rs.getLong("live_bookings"),
                        rs.getInt("avg_stay_minutes"),
                        rs.getBigDecimal("occupancy_rate")));
    }

    private List<TravelTrendPoint> trends() {
        return jdbcTemplate.query(
                """
                SELECT
                    stat_date,
                    SUM(visitor_count) AS visitor_count,
                    SUM(search_count) AS search_count,
                    SUM(booking_count) AS booking_count
                FROM travel_district_daily_summary
                GROUP BY stat_date
                ORDER BY stat_date DESC
                LIMIT 7
                """,
                (rs, rowNum) -> new TravelTrendPoint(
                        rs.getDate("stat_date").toLocalDate(),
                        rs.getLong("visitor_count"),
                        rs.getLong("search_count"),
                        rs.getLong("booking_count")))
                .stream()
                .sorted((left, right) -> left.statDate().compareTo(right.statDate()))
                .toList();
    }

    private List<BatchJobStatus> jobs() {
        return jdbcTemplate.query(
                """
                SELECT
                    job.job_key,
                    job.job_name,
                    job.schedule_type,
                    job.cron_expression,
                    job.notebook_path,
                    job.python_entrypoint,
                    job.target_table,
                    job.elk_index,
                    run.status AS latest_run_status,
                    run.started_at AS latest_run_started_at,
                    run.duration_ms AS latest_run_duration_ms,
                    run.summary_message AS latest_run_summary
                FROM batch_job_definition job
                LEFT JOIN batch_run run
                    ON run.id = (
                        SELECT r.id
                        FROM batch_run r
                        WHERE r.job_key = job.job_key
                        ORDER BY r.started_at DESC
                        LIMIT 1
                    )
                WHERE job.is_active = b'1'
                ORDER BY job.schedule_type, job.job_name
                """,
                (rs, rowNum) -> new BatchJobStatus(
                        rs.getString("job_key"),
                        rs.getString("job_name"),
                        rs.getString("schedule_type"),
                        rs.getString("cron_expression"),
                        rs.getString("notebook_path"),
                        rs.getString("python_entrypoint"),
                        rs.getString("target_table"),
                        rs.getString("elk_index"),
                        rs.getString("latest_run_status"),
                        asLocalDateTime(rs, "latest_run_started_at"),
                        asNullableLong(rs, "latest_run_duration_ms"),
                        rs.getString("latest_run_summary")));
    }

    private List<BatchRunView> recentRuns() {
        return jdbcTemplate.query(
                """
                SELECT
                    run.run_key,
                    job.job_name,
                    run.status,
                    run.notebook_instance,
                    run.records_in,
                    run.records_out,
                    run.started_at,
                    run.ended_at,
                    run.duration_ms,
                    run.summary_message,
                    run.elk_trace_id
                FROM batch_run run
                JOIN batch_job_definition job ON job.job_key = run.job_key
                ORDER BY run.started_at DESC
                LIMIT 8
                """,
                (rs, rowNum) -> new BatchRunView(
                        rs.getString("run_key"),
                        rs.getString("job_name"),
                        rs.getString("status"),
                        rs.getString("notebook_instance"),
                        rs.getInt("records_in"),
                        rs.getInt("records_out"),
                        asLocalDateTime(rs, "started_at"),
                        asLocalDateTime(rs, "ended_at"),
                        asNullableLong(rs, "duration_ms"),
                        rs.getString("summary_message"),
                        rs.getString("elk_trace_id")));
    }

    private List<BatchEventView> recentEvents() {
        return jdbcTemplate.query(
                """
                SELECT
                    event.event_time,
                    job.job_name,
                    run.run_key,
                    event.log_level,
                    event.step_name,
                    event.message,
                    event.payload_json
                FROM batch_run_event event
                JOIN batch_run run ON run.id = event.batch_run_id
                JOIN batch_job_definition job ON job.job_key = run.job_key
                ORDER BY event.event_time DESC
                LIMIT 12
                """,
                (rs, rowNum) -> new BatchEventView(
                        asLocalDateTime(rs, "event_time"),
                        rs.getString("job_name"),
                        rs.getString("run_key"),
                        rs.getString("log_level"),
                        rs.getString("step_name"),
                        rs.getString("message"),
                        rs.getString("payload_json")));
    }

    private LocalDateTime asLocalDateTime(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }

    private Long asNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private record SummaryRow(
            long totalVisitors,
            long totalSearches,
            long totalBookings,
            long foreignVisitors,
            long localVisitors) {
    }
}
