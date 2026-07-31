package dev.adamsalves.ordertracker.auth;

import dev.adamsalves.ordertracker.auth.dto.LoginRequest;
import dev.adamsalves.ordertracker.auth.dto.LoginResponse;
import dev.adamsalves.ordertracker.auth.dto.RegisterRequest;
import dev.adamsalves.ordertracker.auth.dto.RegisterResponse;
import dev.adamsalves.ordertracker.user.User;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Credentials are checked by loading the account and comparing the hash directly. A stateless API
 * with no form login has no use for an AuthenticationManager or a UserDetailsService, and leaving
 * them out keeps the amount of Spring Security wiring proportional to what the API actually does.
 */
@Service
class AuthService {

    private static final String INVALID_CREDENTIALS = "Invalid email or password";
    private static final String EMAIL_TAKEN = "Email already registered";

    /**
     * How long a revocation outlives the token it names. JwtTimestampValidator accepts a token for
     * DEFAULT_MAX_CLOCK_SKEW past its expiry, so a row dropped the moment the token expires would
     * put it back in circulation for the rest of that window. Keep this at or above the skew.
     */
    private static final Duration REVOCATION_GRACE = Duration.ofMinutes(1);

    private static final int MAX_PASSWORD_BYTES = 72;

    private final UserRepository userRepository;
    private final RevokedTokenRepository revokedTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final String decoyHash;

    AuthService(
            UserRepository userRepository,
            RevokedTokenRepository revokedTokenRepository,
            PasswordEncoder passwordEncoder,
            TokenService tokenService) {
        this.userRepository = userRepository;
        this.revokedTokenRepository = revokedTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.decoyHash = passwordEncoder.encode("a password that belongs to nobody");
    }

    @Transactional
    RegisterResponse register(RegisterRequest request) {
        // The ceiling is counted in bytes because that is what BCrypt measures: 72 accented
        // characters are 144 bytes and the encoder refuses them, so a character-based @Size would
        // wave through passwords that cannot be hashed.
        if (request.password().getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Password must be at most %d bytes long".formatted(MAX_PASSWORD_BYTES));
        }

        String email = User.normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, EMAIL_TAKEN);
        }

        try {
            User user =
                    userRepository.save(new User(request.name(), email, passwordEncoder.encode(request.password())));
            return new RegisterResponse(user.getId(), user.getName(), user.getEmail());
        } catch (DataIntegrityViolationException duplicate) {
            // The check above answers the common case with a proper message; this catches the two
            // registrations that pass it at the same time, where only the unique constraint is
            // left to arbitrate.
            throw new ResponseStatusException(HttpStatus.CONFLICT, EMAIL_TAKEN, duplicate);
        }
    }

    @Transactional(readOnly = true)
    LoginResponse login(LoginRequest request) {
        User user =
                userRepository.findByEmail(User.normalizeEmail(request.email())).orElse(null);

        if (user == null) {
            // Hashing against a throwaway value keeps an unknown address as slow to reject as a
            // wrong password, so response time does not disclose which accounts exist.
            passwordEncoder.matches(request.password(), decoyHash);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
        }

        return tokenService.issueFor(user);
    }

    /**
     * Entries that no token can still use are dropped on the way in, which keeps the table bounded
     * without a scheduled job. Only rows past the grace window go: before that the token they name
     * is still being accepted, so the row is the only thing standing in its way.
     */
    @Transactional
    void logout(Jwt token) {
        revokedTokenRepository.deleteExpiredBefore(Instant.now().minus(REVOCATION_GRACE));
        revokedTokenRepository.save(new RevokedToken(token.getId(), token.getExpiresAt()));
    }
}
