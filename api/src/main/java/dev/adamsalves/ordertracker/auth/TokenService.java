package dev.adamsalves.ordertracker.auth;

import dev.adamsalves.ordertracker.auth.dto.LoginResponse;
import dev.adamsalves.ordertracker.config.JwtProperties;
import dev.adamsalves.ordertracker.user.User;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
class TokenService {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);

    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    TokenService(JwtEncoder jwtEncoder, JwtProperties jwtProperties) {
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    /**
     * The subject carries the user id so that a request can be attributed to an account without a
     * second lookup, and the address travels as a claim for display purposes only. The jti gives
     * the token a name of its own, which is what logout records to take it out of circulation.
     */
    LoginResponse issueFor(User user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(jwtProperties.expiration());
        String tokenId = UUID.randomUUID().toString();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .id(tokenId)
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();

        String token = jwtEncoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();

        // The jti and the user id, and neither the address nor the token itself. The jti is what
        // logout records, so a session can be followed from the line that opened it to the line
        // that closed it without the log ever holding a credential or naming an account.
        log.info("Issued token {} to user {}", tokenId, user.getId());

        return new LoginResponse(token, jwtProperties.expiration().toSeconds());
    }
}
