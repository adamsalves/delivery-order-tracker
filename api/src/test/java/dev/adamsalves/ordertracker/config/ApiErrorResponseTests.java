package dev.adamsalves.ordertracker.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Registration stands in for every validated endpoint here: it is reachable without a token, so
 * these cases are about the shape of the answer rather than about who is asking.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/api-error-response.db")
class ApiErrorResponseTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void namesEveryFieldThatFailedValidation() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "email": "not-an-address", "password": "short"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.title").exists())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    /**
     * A blank password that is also too short breaks two rules at once. Keyed by field alone, the
     * second one would have overwritten the first.
     */
    @Test
    void reportsEveryRuleASingleFieldBreaks() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Adams Alves", "email": "adams@example.com", "password": " "}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.password.length()").value(2));
    }

    @Test
    void turnsAwayABodyItCannotParse() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": "))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.detail").value("Failed to read request"));
    }

    /**
     * The password ceiling is checked in the service rather than by an annotation, so it arrives as
     * a status-carrying exception instead of a validation failure. It has to come out in the same
     * shape as the rest.
     */
    @Test
    void answersAFailureRaisedInsideTheServiceInTheSameShape() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Adams Alves", "email": "long@example.com", "password": "%s"}""".formatted("é".repeat(72))))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400));
    }
}
