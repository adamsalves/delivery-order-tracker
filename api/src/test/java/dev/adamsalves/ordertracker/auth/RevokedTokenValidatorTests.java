package dev.adamsalves.ordertracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

@ExtendWith(MockitoExtension.class)
class RevokedTokenValidatorTests {

    private static final String TOKEN_ID = "8b1f0c4e-token-id";

    @Mock
    private RevokedTokenRepository revokedTokenRepository;

    @Test
    void acceptsATokenThatWasNeverHandedBack() {
        when(revokedTokenRepository.existsById(TOKEN_ID)).thenReturn(false);

        assertThat(validate(token().build()).hasErrors()).isFalse();
    }

    @Test
    void refusesATokenThatWasHandedBackAtLogout() {
        when(revokedTokenRepository.existsById(TOKEN_ID)).thenReturn(true);

        assertThat(refusalsFor(token().build())).containsExactly("Token has been revoked");
    }

    /**
     * Without a jti there is nothing for logout to write down, so the token could never be taken
     * out of circulation. The refusal has to name that reason rather than claim it was revoked.
     */
    @Test
    void refusesATokenWithNoIdentifierOfItsOwn() {
        Jwt anonymous = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("1")
                .expiresAt(Instant.now().plus(Duration.ofHours(1)))
                .build();

        assertThat(refusalsFor(anonymous)).containsExactly("Token cannot be revoked");
    }

    @Test
    void refusesATokenThatNeverExpires() {
        Jwt everlasting = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("1")
                .jti(TOKEN_ID)
                .build();

        assertThat(refusalsFor(everlasting)).containsExactly("Token cannot be revoked");
    }

    private Jwt.Builder token() {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("1")
                .jti(TOKEN_ID)
                .expiresAt(Instant.now().plus(Duration.ofHours(1)));
    }

    private OAuth2TokenValidatorResult validate(Jwt token) {
        return new RevokedTokenValidator(revokedTokenRepository).validate(token);
    }

    private List<String> refusalsFor(Jwt token) {
        return validate(token).getErrors().stream()
                .map(OAuth2Error::getDescription)
                .toList();
    }
}
