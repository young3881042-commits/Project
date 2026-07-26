package com.platform.jupiter.chat;

import jakarta.annotation.PostConstruct;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ChatUsageService {
    private final JdbcTemplate jdbcTemplate;

    public ChatUsageService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void initialize() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS app_user_chat_usage (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(40) NOT NULL,
                    provider VARCHAR(24) NOT NULL,
                    model VARCHAR(120) NOT NULL,
                    input_tokens BIGINT NOT NULL,
                    output_tokens BIGINT NOT NULL,
                    total_tokens BIGINT NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL,
                    INDEX idx_chat_usage_user_time (username, created_at),
                    INDEX idx_chat_usage_user_provider_model (username, provider, model)
                )
                """);
    }

    public void recordUsage(String username, String provider, String model, ChatUsage usage) {
        if (usage == null) {
            return;
        }
        String normalizedProvider = provider == null || provider.isBlank() ? "unknown" : provider.trim().toLowerCase();
        String normalizedModel = model == null || model.isBlank() ? "unknown" : model.trim();
        jdbcTemplate.update(
                """
                INSERT INTO app_user_chat_usage
                    (username, provider, model, input_tokens, output_tokens, total_tokens, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                username,
                normalizedProvider,
                normalizedModel,
                Math.max(0, usage.inputTokens()),
                Math.max(0, usage.outputTokens()),
                Math.max(0, usage.totalTokens()),
                Timestamp.from(Instant.now()));
    }

    public ChatUsageResponse usage(String username) {
        Instant now = Instant.now();
        Instant fiveHoursAgo = now.minus(Duration.ofHours(5));
        Instant sevenDaysAgo = now.minus(Duration.ofDays(7));
        return new ChatUsageResponse(
                now,
                List.of(
                        summarizeWindow(username, "5h", "최근 5시간", fiveHoursAgo),
                        summarizeWindow(username, "7d", "최근 7일", sevenDaysAgo)),
                modelBreakdown(username, sevenDaysAgo));
    }

    private ChatUsageWindow summarizeWindow(String username, String id, String label, Instant since) {
        return jdbcTemplate.queryForObject(
                """
                SELECT
                    COUNT(*) AS calls,
                    COALESCE(SUM(input_tokens), 0) AS input_tokens,
                    COALESCE(SUM(output_tokens), 0) AS output_tokens,
                    COALESCE(SUM(total_tokens), 0) AS total_tokens
                FROM app_user_chat_usage
                WHERE username = ? AND created_at >= ?
                """,
                (rs, rowNum) -> new ChatUsageWindow(
                        id,
                        label,
                        since,
                        longValue(rs, "calls"),
                        longValue(rs, "input_tokens"),
                        longValue(rs, "output_tokens"),
                        longValue(rs, "total_tokens")),
                username,
                Timestamp.from(since));
    }

    private List<ChatUsageModelBreakdown> modelBreakdown(String username, Instant since) {
        return jdbcTemplate.query(
                """
                SELECT
                    provider,
                    model,
                    COUNT(*) AS calls,
                    COALESCE(SUM(input_tokens), 0) AS input_tokens,
                    COALESCE(SUM(output_tokens), 0) AS output_tokens,
                    COALESCE(SUM(total_tokens), 0) AS total_tokens
                FROM app_user_chat_usage
                WHERE username = ? AND created_at >= ?
                GROUP BY provider, model
                ORDER BY total_tokens DESC, calls DESC
                LIMIT 8
                """,
                (rs, rowNum) -> new ChatUsageModelBreakdown(
                        rs.getString("provider"),
                        rs.getString("model"),
                        longValue(rs, "calls"),
                        longValue(rs, "input_tokens"),
                        longValue(rs, "output_tokens"),
                        longValue(rs, "total_tokens")),
                username,
                Timestamp.from(since));
    }

    private long longValue(ResultSet rs, String column) throws SQLException {
        return Math.max(0L, rs.getLong(column));
    }
}
