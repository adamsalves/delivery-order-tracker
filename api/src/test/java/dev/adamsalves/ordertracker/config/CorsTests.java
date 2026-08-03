package dev.adamsalves.ordertracker.config;

import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_HEADERS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS;
import static org.springframework.http.HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpHeaders.ORIGIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * The front end is served from another port, so every call it makes is cross-origin and none of them
 * happen unless the browser is told they may. Which origins those are comes from
 * app.cors.allowed-origins, which is the kind of property a deployment changes and nothing was
 * watching.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/cors.db")
class CorsTests {

    private static final String DEV_SERVER = "http://localhost:5173";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * A browser sends the preflight without the Authorization header, so this is the one call the
     * API answers to an anonymous caller on a protected path. Requiring a token here would refuse
     * the question that asks whether the token may be sent at all.
     */
    @Test
    void answersThePreflightTheBrowserSendsBeforeAProtectedCall() throws Exception {
        mockMvc.perform(options("/api/orders")
                        .header(ORIGIN, DEV_SERVER)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, DEV_SERVER))
                .andExpect(header().stringValues(ACCESS_CONTROL_ALLOW_METHODS, "GET,POST,PATCH,OPTIONS"))
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_HEADERS, "Authorization, Content-Type"));
    }

    /**
     * PATCH is the one a status change needs and the one most easily left out of a list written for
     * reading and creating.
     */
    @Test
    void clearsThePreflightForAStatusChange() throws Exception {
        mockMvc.perform(options("/api/orders/1/status")
                        .header(ORIGIN, DEV_SERVER)
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "PATCH"))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, DEV_SERVER));
    }

    @Test
    void turnsDownAPreflightFromAnOriginItWasNotToldAbout() throws Exception {
        mockMvc.perform(options("/api/orders")
                        .header(ORIGIN, "http://somewhere.else")
                        .header(ACCESS_CONTROL_REQUEST_METHOD, "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    /**
     * Clearing the preflight is only half of it: the answer to the real call has to carry the header
     * too, or the browser holds the response back after the API has already done the work.
     */
    @Test
    void marksTheAnswerToTheRealCallForTheOriginThatAskedIt() throws Exception {
        String token = new ApiTestClient(mockMvc, objectMapper).registerAndLogin("cors@example.com");

        mockMvc.perform(get("/api/orders").header(ORIGIN, DEV_SERVER).header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_ALLOW_ORIGIN, DEV_SERVER));
    }

    /**
     * Arriving is not the same as being readable. The browser withholds every response header a
     * cross-origin caller was not told it may see, and the request id is one of ours, so without
     * being named here it reaches the front end only to read back as null — which is the whole of
     * what it is for, since the front end is what the person reporting the error is looking at.
     */
    @Test
    void letsTheBrowserReadTheRequestId() throws Exception {
        String token = new ApiTestClient(mockMvc, objectMapper).registerAndLogin("expose@example.com");

        mockMvc.perform(get("/api/orders").header(ORIGIN, DEV_SERVER).header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string(ACCESS_CONTROL_EXPOSE_HEADERS, RequestIdFilter.HEADER));
    }

    /**
     * Credentials stay off because the token travels in a header of our own. Allowing them would
     * hand cookies to a cross-origin call the API never asked to be reachable by.
     */
    @Test
    void doesNotOfferToCarryCredentials() throws Exception {
        mockMvc.perform(options("/api/orders").header(ORIGIN, DEV_SERVER).header(ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().doesNotExist(ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }
}
