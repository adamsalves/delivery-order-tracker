package dev.adamsalves.ordertracker.auth;

import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RevokedTokenRepository extends JpaRepository<RevokedToken, String> {

    /**
     * Written out rather than derived: a derived delete loads every matching row and removes them
     * one at a time, which is a statement per expired token.
     */
    @Modifying
    @Query("delete from RevokedToken token where token.expiresAt < :moment")
    void deleteExpiredBefore(@Param("moment") Instant moment);
}
