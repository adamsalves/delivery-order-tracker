package dev.adamsalves.ordertracker.auth;

import dev.adamsalves.ordertracker.auth.dto.LoginResponse;
import dev.adamsalves.ordertracker.config.JwtProperties;
import dev.adamsalves.ordertracker.user.User;
import java.time.Instant;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
class TokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    TokenService(JwtEncoder jwtEncoder, JwtProperties jwtProperties) {
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    /**
     * The subject carries the user id so that a request can be attributed to an account without a
     * second lookup, and the address travels as a claim for display purposes only.
     */
    LoginResponse issueFor(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(jwtProperties.expiration());

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();

        String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
        return new LoginResponse(token, jwtProperties.expiration().toSeconds());
    }
}
