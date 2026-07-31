package dev.adamsalves.ordertracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/auth-flow.db")
class AuthFlowIntegrationTests {

    private static final String EMAIL = "adams@example.com";
    private static final String PASSWORD = "a-long-enough-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RevokedTokenRepository revokedTokenRepository;

    @BeforeEach
    void startFromAnEmptyTable() {
        revokedTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void aTokenStopsBeingAcceptedOnceItsOwnerLogsOut() throws Exception {
        register(EMAIL, PASSWORD);
        String token = login(EMAIL, PASSWORD);

        mockMvc.perform(get("/api/orders").header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout").header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/orders").header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRetiresOneTokenRatherThanTheAccount() throws Exception {
        register(EMAIL, PASSWORD);
        String first = login(EMAIL, PASSWORD);
        mockMvc.perform(post("/api/auth/logout").header(AUTHORIZATION, "Bearer " + first))
                .andExpect(status().isNoContent());

        String second = login(EMAIL, PASSWORD);

        mockMvc.perform(get("/api/orders").header(AUTHORIZATION, "Bearer " + second))
                .andExpect(status().isOk());
    }

    /**
     * A token stays acceptable for the timestamp validator's clock skew after its expiry, so its
     * revocation has to outlive it by at least as long. Sweeping on expiry alone put a token that
     * had been handed back at logout straight back into circulation.
     */
    @Test
    void keepsARevocationUntilTheClockSkewWindowHasClosed() throws Exception {
        revokedTokenRepository.save(
                new RevokedToken("just-expired", Instant.now().minus(Duration.ofSeconds(10))));
        revokedTokenRepository.save(
                new RevokedToken("long-expired", Instant.now().minus(Duration.ofMinutes(5))));

        register(EMAIL, PASSWORD);
        String token = login(EMAIL, PASSWORD);
        mockMvc.perform(post("/api/auth/logout").header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());

        assertThat(revokedTokenRepository.existsById("just-expired")).isTrue();
        assertThat(revokedTokenRepository.existsById("long-expired")).isFalse();
    }

    @Test
    void registrationAnswersWithoutThePasswordHash() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("Adams Alves", EMAIL, PASSWORD)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void refusesAnAddressAlreadyTakenUnderDifferentCasing() throws Exception {
        register(EMAIL, PASSWORD);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("Someone Else", "ADAMS@Example.COM", PASSWORD)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("Email already registered"));
    }

    @Test
    void answersTheSameWayForAWrongPasswordAndAnUnknownAddress() throws Exception {
        register(EMAIL, PASSWORD);

        String wrongPassword = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(EMAIL, "not-the-right-password")))
                .andExpect(status().isUnauthorized())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String unknownAddress = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("nobody@example.com", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(objectMapper.readTree(wrongPassword).path("detail").asText())
                .isEqualTo(objectMapper.readTree(unknownAddress).path("detail").asText())
                .isEqualTo("Invalid email or password");
    }

    /**
     * BCrypt measures the ceiling in bytes, so a password of 72 accented characters is over it. It
     * has to be turned away at the border rather than blow up inside the encoder.
     */
    @Test
    void refusesAPasswordThatBcryptCouldNotHash() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("Adams Alves", EMAIL, "é".repeat(72))))
                .andExpect(status().isBadRequest());
    }

    private void register(String email, String password) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration("Adams Alves", email, password)))
                .andExpect(status().isCreated());
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(body).path("token").asText();
    }

    private String registration(String name, String email, String password) throws Exception {
        return objectMapper.writeValueAsString(Map.of("name", name, "email", email, "password", password));
    }

    private String credentials(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(Map.of("email", email, "password", password));
    }
}
