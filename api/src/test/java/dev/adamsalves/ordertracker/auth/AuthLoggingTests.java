package dev.adamsalves.ordertracker.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
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
 * Orders have carried an audit trail from the start; sessions carried none. These cases are about
 * what a session now leaves behind, and — the half that matters more — what it deliberately does
 * not.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/auth-logging.db")
class AuthLoggingTests {

    private static final String EMAIL = "quem.entrou@example.com";
    private static final String UNKNOWN_EMAIL = "conta.que.nao.existe@example.com";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private final ListAppender<ILoggingEvent> recorded = new ListAppender<>();

    private ApiTestClient api;

    @BeforeEach
    void listen() {
        userRepository.deleteAll();

        api = new ApiTestClient(mockMvc, objectMapper);
        recorded.start();
        rootLogger().addAppender(recorded);
    }

    @AfterEach
    void stopListening() {
        rootLogger().detachAppender(recorded);
        recorded.stop();
    }

    /**
     * The jti is the handle: logout already records it, so a session that can be followed from the
     * line issuing the token to the line revoking it needs nothing else — and nothing else is what
     * the two lines carry.
     */
    @Test
    void followsASessionFromTheTokenIssuedToTheTokenRevoked() throws Exception {
        String token = api.registerAndLogin(EMAIL);
        logout(token);

        String tokenId = tokenIdOf(token);

        assertThat(messagesFrom(TokenService.class)).anyMatch(line -> line.contains(tokenId));
        assertThat(messagesFrom(AuthService.class)).anyMatch(line -> line.contains(tokenId));
    }

    /**
     * A wrong password and an address nobody registered have to be one line saying the same thing.
     * Hashing against a decoy already keeps the two indistinguishable by timing, and a log that
     * sorted them apart would give back over the logs what the timing no longer discloses.
     */
    @Test
    void recordsARejectedLoginWithoutNamingWhoTriedIt() throws Exception {
        api.registerAndLogin(EMAIL);

        rejectedLogin(EMAIL, "not-the-password-on-file");
        rejectedLogin(UNKNOWN_EMAIL, "not-the-password-on-file");

        List<String> rejections = messagesFrom(AuthService.class, Level.WARN);

        assertThat(rejections).hasSize(2);
        assertThat(rejections.get(0)).isEqualTo(rejections.get(1));
        assertThat(everythingWritten()).noneMatch(line -> line.contains(EMAIL) || line.contains(UNKNOWN_EMAIL));
    }

    private void rejectedLogin(String email, String password) throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isUnauthorized());
    }

    private void logout(String token) throws Exception {
        mockMvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    private String tokenIdOf(String token) {
        byte[] claims = Base64.getUrlDecoder().decode(token.split("\\.")[1]);

        return objectMapper.readTree(claims).path("jti").asText();
    }

    private List<String> everythingWritten() {
        return recorded.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
    }

    private List<String> messagesFrom(Class<?> source) {
        return recorded.list.stream()
                .filter(event -> event.getLoggerName().equals(source.getName()))
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
    }

    private List<String> messagesFrom(Class<?> source, Level level) {
        return recorded.list.stream()
                .filter(event -> event.getLoggerName().equals(source.getName()) && event.getLevel() == level)
                .map(ILoggingEvent::getFormattedMessage)
                .toList();
    }

    private Logger rootLogger() {
        return (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
    }
}
