package com.platform.jupiter.auth;

import com.platform.jupiter.config.AppProperties;
import com.platform.jupiter.files.FileService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ADMIN_ROLE = "ADMIN";
    private static final String USER_ROLE = "USER";
    private static final String GUEST_USERNAME = "guestuser";
    private static final String GUEST_PASSWORD = "guest1234";

    private final AppUserAccountRepository repository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final FileService fileService;
    private final AppProperties appProperties;
    private final JdbcTemplate jdbcTemplate;
    private final Map<String, AuthSession> sessions = new ConcurrentHashMap<>();

    public AuthService(
            AppUserAccountRepository repository,
            BCryptPasswordEncoder passwordEncoder,
            FileService fileService,
            AppProperties appProperties,
            JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.fileService = fileService;
        this.appProperties = appProperties;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void initialize() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS app_user_account (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(40) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(16) NOT NULL,
                    created_at TIMESTAMP(6) NOT NULL,
                    updated_at TIMESTAMP(6) NOT NULL
                )
                """);
        if (!repository.existsByUsername("admin")) {
            AppUserAccount admin = new AppUserAccount();
            admin.setUsername("admin");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setRole(ADMIN_ROLE);
            repository.save(admin);
        }
        if (!repository.existsByUsername(GUEST_USERNAME)) {
            AppUserAccount guest = new AppUserAccount();
            guest.setUsername(GUEST_USERNAME);
            guest.setPasswordHash(passwordEncoder.encode(GUEST_PASSWORD));
            guest.setRole(USER_ROLE);
            repository.save(guest);
            fileService.ensureUserWorkspace(GUEST_USERNAME);
        }
    }

    @Transactional
    public AuthResponse signup(AuthSignupRequest request) {
        String username = normalizeUsername(request.username());
        if (repository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }

        AppUserAccount account = new AppUserAccount();
        account.setUsername(username);
        account.setPasswordHash(passwordEncoder.encode(request.password()));
        account.setRole(USER_ROLE);
        repository.save(account);
        fileService.ensureUserWorkspace(username);
        return login(new AuthLoginRequest(username, request.password()));
    }

    public AuthResponse login(AuthLoginRequest request) {
        String username = normalizeUsername(request.username());
        AppUserAccount account = repository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));
        if (!passwordEncoder.matches(request.password(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        String role = account.getRole() == null ? USER_ROLE : account.getRole().toUpperCase(Locale.ROOT);
        String token = newToken();
        AuthSession session = new AuthSession(username, role, ADMIN_ROLE.equals(role), token);
        sessions.put(token, session);
        if (!session.admin()) {
            fileService.ensureUserWorkspace(session.username());
        }
        return new AuthResponse(
                session.username(),
                session.role(),
                session.token(),
                session.admin() ? appProperties.launcherUrl() : "");
    }

    public AuthSession requireSession(HttpServletRequest request) {
        String header = Optional.ofNullable(request.getHeader("Authorization")).orElse("");
        if (!header.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing bearer token");
        }
        String token = header.substring("Bearer ".length()).trim();
        return requireSession(token);
    }

    public AuthSession requireSession(String token) {
        AuthSession session = sessions.get(token);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid session");
        }
        return session;
    }

    @Transactional
    public void updatePassword(String username, AccountPasswordUpdateRequest request) {
        AppUserAccount account = repository.findByUsername(normalizeUsername(username))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호가 일치하지 않습니다.");
        }
        if (request.currentPassword().equals(request.newPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "새 비밀번호는 현재 비밀번호와 달라야 합니다.");
        }
        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        repository.save(account);
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }

    private String newToken() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
