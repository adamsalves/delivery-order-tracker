package dev.adamsalves.ordertracker.auth;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs alongside the signature and expiry checks so that a token handed back at logout stops being
 * accepted immediately, instead of lingering until it expires on its own.
 */
@Component
class RevokedTokenValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error REVOKED = new OAuth2Error("invalid_token", "Token has been revoked", null);

    /**
     * A token this validator could never act on: without a jti there is nothing for logout to
     * record, and without an exp the record would never become safe to sweep. Accepting either
     * would mean handing out a token that cannot be taken back, so both are refused.
     */
    private static final OAuth2Error UNREVOCABLE = new OAuth2Error("invalid_token", "Token cannot be revoked", null);

    private final RevokedTokenRepository revokedTokenRepository;

    RevokedTokenValidator(RevokedTokenRepository revokedTokenRepository) {
        this.revokedTokenRepository = revokedTokenRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public OAuth2TokenValidatorResult validate(Jwt token) {
        if (token.getId() == null || token.getExpiresAt() == null) {
            return OAuth2TokenValidatorResult.failure(UNREVOCABLE);
        }
        if (revokedTokenRepository.existsById(token.getId())) {
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
        return OAuth2TokenValidatorResult.success();
    }
}
