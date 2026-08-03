package dev.adamsalves.ordertracker.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
 * The shape of a refusal, whatever raised it. Registration stands in for the validated endpoints
 * because it is reachable without a token, which keeps these cases about the answer rather than
 * about who is asking.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/api-error-response.db")
class ApiErrorResponseTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Sorting is turned down inside the service rather than by the framework, so this is the case
     * that would notice if a refusal raised down there stopped coming out as a problem detail. The
     * title is asserted because it is not set by hand: it comes off the status, and the two halves
     * of the advice have to keep answering in the same shape.
     */
    @Test
    void answersAnUnsortablePropertyWithTheOnesItAccepts() throws Exception {
        String token = new ApiTestClient(mockMvc, objectMapper).registerAndLogin("sorting@example.com");

        String body = mockMvc.perform(get("/api/orders")
                        .header(AUTHORIZATION, "Bearer " + token)
                        .param("sort", "items"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Bad Request"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(objectMapper.readTree(body).path("detail").asText())
                .contains("items")
                .contains("createdAt");
    }

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
     * The stock messages read in one language and ours in another would make the payload bilingual,
     * so this pins the half we do not write. Hibernate Validator ships a bundle per locale and
     * resolves it from Accept-Language, which is the usual reason an API answers "não deve estar em
     * branco" next to an English detail. What keeps it from happening here is a fixed locale, set
     * in application.properties; these cases are what would notice if that were dropped.
     */
    @ParameterizedTest
    @ValueSource(strings = {"pt-BR", "pt", "en", "de"})
    void wordsTheStockValidationMessagesTheSameWhateverTheClientAsksFor(String language) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .header(HttpHeaders.ACCEPT_LANGUAGE, language)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "", "email": "not-an-address", "password": "short"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name[0]").value("must not be blank"))
                .andExpect(jsonPath("$.errors.email[0]").value("must be a well-formed email address"))
                .andExpect(jsonPath("$.errors.password[0]").value("size must be between 8 and 72"));
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
