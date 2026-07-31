package dev.adamsalves.ordertracker.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;

interface RevokedTokenRepository extends JpaRepository<RevokedToken, String> {

    void deleteByExpiresAtBefore(Instant moment);
}
