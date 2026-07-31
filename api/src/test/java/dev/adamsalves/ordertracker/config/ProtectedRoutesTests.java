package dev.adamsalves.ordertracker.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The openings in the chain are named one route at a time, so a route added later is closed unless
 * somebody says otherwise. These cases are what would notice if the list turned back into a prefix.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/protected-routes.db")
class ProtectedRoutesTests {

    @Autowired
    private MockMvc mockMvc;

    @ParameterizedTest
    @CsvSource({
        "GET,/api/orders",
        "GET,/api/orders/1",
        "POST,/api/orders",
        "PATCH,/api/orders/1/status",
        "POST,/api/auth/logout"
    })
    void refusesTheRouteWithoutABearerToken(String method, String path) throws Exception {
        mockMvc.perform(request(HttpMethod.valueOf(method), path)).andExpect(status().isUnauthorized());
    }

    /**
     * The refusal a bearer API gives most often is the one raised in the filter chain, where the
     * advice cannot reach. These two are what would notice if it went back to answering with an
     * empty body while every other failure answers RFC 9457.
     */
    @Test
    void answersAMissingTokenWithAProblemDetail() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(header().exists(HttpHeaders.WWW_AUTHENTICATE))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.detail").isNotEmpty())
                .andExpect(jsonPath("$.instance").value("/api/orders"));
    }

    /**
     * The body stays the same whether the token was absent or rejected: sorting the two apart is
     * what the WWW-Authenticate header is for, and doing it in the body would tell an attacker
     * which tokens are worth trying again.
     */
    @Test
    void answersARejectedTokenWithTheSameProblemDetail() throws Exception {
        mockMvc.perform(get("/api/orders").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").isNotEmpty());
    }

    /**
     * A 400 means the request reached validation, which is as far as it should get: these two are
     * the only way in, and they cannot ask for a token that does not exist yet.
     */
    @ParameterizedTest
    @ValueSource(strings = {"/api/auth/register", "/api/auth/login"})
    void letsTheWayInThrough(String path) throws Exception {
        mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    /**
     * The page describing how to obtain a token cannot be behind one.
     */
    @ParameterizedTest
    @ValueSource(strings = {"/v3/api-docs", "/swagger-ui/index.html"})
    void letsTheDocumentationBeReadWithoutAToken(String path) throws Exception {
        mockMvc.perform(get(path)).andExpect(status().isOk());
    }
}
