package com.platform.jupiter.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserAccountRepository extends JpaRepository<AppUserAccount, Long> {
    Optional<AppUserAccount> findByUsername(String username);
    boolean existsByUsername(String username);
}
