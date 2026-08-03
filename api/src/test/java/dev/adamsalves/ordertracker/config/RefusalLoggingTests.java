package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.support.RecordedLogs;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * A refusal used to leave the API without a trace of itself. These cases are about the line it
 * leaves now, and about the part of the refusal that must stay out of it.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/refusal-logging.db")
class RefusalLoggingTests {

    private static final String EMAIL = "quem.foi.recusado@example.com";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private RecordedLogs logs;
    private ApiTestClient api;

    @BeforeEach
    void listen() {
        userRepository.deleteAll();

        api = new ApiTestClient(mockMvc, objectMapper);
        logs = new RecordedLogs();
    }

    @AfterEach
    void stopListening() {
        logs.close();
    }

    /**
     * The message of a validation failure is the request coming back: it prints every value it
     * rejected, and the one being rejected here is a password. The line has to record that the
     * request was refused without becoming the place the password is kept.
     */
    @Test
    void keepsARejectedPasswordOutOfTheLog() throws Exception {
        String password = "s3cr3t";

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Adams Alves", "email", EMAIL, "password", password))))
                .andExpect(status().isBadRequest());

        assertThat(logs.from(ApiExceptionHandler.class, Level.WARN)).hasSize(1);
        assertThat(logs.all()).noneMatch(line -> line.contains(password));
    }

    /**
     * What makes a rate of refusals readable is which route gave them and what it answered. Both go
     * in the line; the exception is named, its message is not.
     */
    @Test
    void namesTheRouteAndTheStatusItAnswered() throws Exception {
        String token = api.registerAndLogin(EMAIL);

        mockMvc.perform(get("/api/orders/404404").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound());

        List<String> refusals = logs.from(ApiExceptionHandler.class, Level.WARN);

        assertThat(refusals).hasSize(1);
        assertThat(refusals.getFirst()).contains("/api/orders/404404").contains("404");
    }

    /**
     * The refusal a bearer API gives most often never reaches the advice: it is written in the
     * filter chain, before the dispatcher servlet. It is also the one a rate is worth watching for,
     * and it used to leave nothing at all — the request id came back naming a request no line
     * mentioned.
     */
    @Test
    void recordsARefusalWrittenBeforeTheApplicationIsReached() throws Exception {
        mockMvc.perform(get("/api/orders")).andExpect(status().isUnauthorized());

        List<String> refusals = logs.from(ProblemDetailAuthenticationHandler.class, Level.WARN);

        assertThat(refusals).hasSize(1);
        assertThat(refusals.getFirst()).contains("/api/orders").contains("401");
    }

    /**
     * A token that was turned down is still a token, and the exception carrying it back is the
     * bearer failure quoting what it could not decode. Revoked is the case to press: the token is
     * well formed and genuinely was ours, so nothing upstream drops it before the line is written.
     *
     * <p>The scheme is matched with the space that follows it in the header. Without it the check
     * passes on the name of the exception itself, which is the one place the word is allowed.
     */
    @Test
    void keepsARefusedTokenOutOfTheLog() throws Exception {
        String token = api.registerAndLogin(EMAIL);

        mockMvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/orders").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized());

        assertThat(logs.from(ProblemDetailAuthenticationHandler.class, Level.WARN))
                .hasSize(1);
        assertThat(logs.all()).noneMatch(line -> line.contains(token) || line.contains("Bearer "));
    }
}
