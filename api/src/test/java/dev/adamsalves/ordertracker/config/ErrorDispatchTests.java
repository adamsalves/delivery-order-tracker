package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import dev.adamsalves.ordertracker.support.RecordedLogs;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

/**
 * A failure the container has to render is dispatched to /error, and the security chain runs on
 * that dispatch as well. Runs against a real server because MockMvc does not reproduce the second
 * dispatch, which is the whole point of the test.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/error-dispatch.db")
class ErrorDispatchTests {

    @Value("${local.server.port}")
    private int port;

    private RestClient client;
    private RecordedLogs logs;

    @BeforeEach
    void pointAtTheRunningServer() {
        client = RestClient.create("http://localhost:" + port);
        logs = new RecordedLogs();
    }

    @AfterEach
    void stopListening() {
        logs.close();
    }

    /**
     * The caller is anonymous on purpose: that is the case the second dispatch used to break. A
     * request that carries a token is authenticated again on the way to /error and comes out fine,
     * so it would pass whether or not the chain lets the dispatch through.
     */
    @Test
    void rendersAnUnexpectedFailureForAnAnonymousCallerInsteadOfDemandingAToken() {
        HttpStatusCode status = client.get().uri("/api/boom").exchange((request, response) -> response.getStatusCode());

        assertThat(status).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * The one line in the API that carries a stack trace, and the reason the filter catches on the
     * way out at all. The container writes its own account of the same failure afterwards, by which
     * point the request has left the filter and the id is gone from the MDC — this is the copy that
     * can still be tied to the request that caused it.
     *
     * <p>Runs here rather than under MockMvc because this is where a failure genuinely goes
     * unhandled: the advice answers everything that reaches the dispatcher servlet.
     */
    @Test
    void recordsTheFailureNobodyHandled() {
        client.get().uri("/api/boom").exchange((request, response) -> response.getStatusCode());

        List<String> failures = logs.from(RequestIdFilter.class, Level.ERROR);

        assertThat(failures).hasSize(1);
        assertThat(failures.getFirst())
                .contains("GET")
                .contains("/api/boom")
                .contains("IllegalStateException")
                .contains("\tat ");
    }

    /**
     * The failing route is opened by a chain of its own so the request can reach the controller
     * without a token. /error is not matched here, so it is still the application's own chain that
     * decides what happens on the dispatch — which is what this test is about.
     */
    @TestConfiguration
    static class PubliclyExplodingEndpoint {

        @Bean
        @Order(1)
        SecurityFilterChain explodingEndpointChain(HttpSecurity http) throws Exception {
            return http.securityMatcher("/api/boom")
                    .csrf(AbstractHttpConfigurer::disable)
                    .authorizeHttpRequests(requests -> requests.anyRequest().permitAll())
                    .build();
        }

        @RestController
        static class Boom {

            @GetMapping("/api/boom")
            String explode() {
                throw new IllegalStateException("a failure that has nothing to do with authentication");
            }
        }
    }
}
