package dev.adamsalves.ordertracker.auth;

import dev.adamsalves.ordertracker.auth.dto.LoginRequest;
import dev.adamsalves.ordertracker.auth.dto.LoginResponse;
import dev.adamsalves.ordertracker.auth.dto.RegisterRequest;
import dev.adamsalves.ordertracker.auth.dto.RegisterResponse;
import dev.adamsalves.ordertracker.user.User;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.time.Instant;
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
        String email = User.normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = userRepository.save(new User(request.name(), email, passwordEncoder.encode(request.password())));
        return new RegisterResponse(user.getId(), user.getName(), user.getEmail());
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
     * Expired entries are dropped on the way in, which keeps the table bounded without a scheduled
     * job: a token that is past its expiry is already refused by the timestamp check, so its row
     * has nothing left to say.
     */
    @Transactional
    void logout(Jwt token) {
        revokedTokenRepository.deleteByExpiresAtBefore(Instant.now());
        revokedTokenRepository.save(new RevokedToken(token.getId(), token.getExpiresAt()));
    }
}
