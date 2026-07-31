package dev.adamsalves.ordertracker.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A token that was handed back at logout. Only the identifier and the moment the token would have
 * expired anyway are kept: once that moment passes the row stops meaning anything, because the
 * signature check rejects the token on its own.
 */
@Entity
@Table(name = "revoked_tokens")
class RevokedToken {

    @Id
    private String id;

    @Column(nullable = false)
    private Instant expiresAt;

    protected RevokedToken() {}

    RevokedToken(String id, Instant expiresAt) {
        this.id = id;
        this.expiresAt = expiresAt;
    }

    String getId() {
        return id;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }
}
