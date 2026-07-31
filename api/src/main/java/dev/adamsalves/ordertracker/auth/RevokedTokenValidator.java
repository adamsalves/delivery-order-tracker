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

    private final RevokedTokenRepository revokedTokenRepository;

    RevokedTokenValidator(RevokedTokenRepository revokedTokenRepository) {
        this.revokedTokenRepository = revokedTokenRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public OAuth2TokenValidatorResult validate(Jwt token) {
        String id = token.getId();
        if (id == null || revokedTokenRepository.existsById(id)) {
            // A token with no jti cannot be looked up, so it can never be revoked either. Refusing
            // it keeps every accepted token revocable.
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
        return OAuth2TokenValidatorResult.success();
    }
}
