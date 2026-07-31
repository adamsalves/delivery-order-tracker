package dev.adamsalves.ordertracker.config;

import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
class JwtConfig {

    private static final int MINIMUM_SECRET_BYTES = 32;

    /**
     * HS256 rejects keys shorter than 256 bits, and it does so when a token is first signed rather
     * than when the key is built. Checking here turns a misconfigured secret into a startup failure
     * instead of a login that breaks in production. There is deliberately no built-in secret to
     * fall back on: one would have to ship in the repository, and a deployment that forgot to set
     * JWT_SECRET would sign its tokens with a key everybody can read.
     */
    @Bean
    SecretKey jwtSecretKey(JwtProperties properties) {
        if (properties.secret() == null || properties.secret().isBlank()) {
            throw new IllegalStateException(
                    "app.jwt.secret is not set: export JWT_SECRET, or put it in api/.env (see api/.env.example)");
        }

        byte[] secret = properties.secret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < MINIMUM_SECRET_BYTES) {
            throw new IllegalStateException("app.jwt.secret must be at least %d bytes long for HS256, but was %d"
                    .formatted(MINIMUM_SECRET_BYTES, secret.length));
        }
        return new SecretKeySpec(secret, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSecretKey)
                .algorithm(MacAlgorithm.HS256)
                .build();
    }

    /**
     * The extra validators are composed with the defaults rather than replacing them, so signature
     * and expiry keep being enforced.
     */
    @Bean
    JwtDecoder jwtDecoder(SecretKey jwtSecretKey, List<OAuth2TokenValidator<Jwt>> validators) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithValidators(validators));
        return decoder;
    }
}
