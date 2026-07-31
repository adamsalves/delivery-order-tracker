package dev.adamsalves.ordertracker.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
