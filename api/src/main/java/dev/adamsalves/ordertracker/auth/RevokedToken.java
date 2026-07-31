package dev.adamsalves.ordertracker.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.springframework.data.domain.Persistable;

/**
 * A token that was handed back at logout. Only the identifier and the moment the token would have
 * expired anyway are kept: once that moment passes the row stops meaning anything, because the
 * signature check rejects the token on its own.
 */
@Entity
@Table(name = "revoked_tokens")
class RevokedToken implements Persistable<String> {

    @Id
    private String id;

    @Column(nullable = false)
    private Instant expiresAt;

    protected RevokedToken() {}

    RevokedToken(String id, Instant expiresAt) {
        this.id = id;
        this.expiresAt = expiresAt;
    }

    /**
     * The identifier comes from the token rather than from the database, so Spring Data would read
     * the row as detached and merge it, selecting before every insert. A revocation is written once
     * and never updated.
     */
    @Override
    public boolean isNew() {
        return true;
    }

    @Override
    public String getId() {
        return id;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }
}
