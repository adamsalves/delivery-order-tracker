package dev.adamsalves.ordertracker.support;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/**
 * Drives the API the way a client would, so that tests about something else can get hold of a token
 * and an order without spelling out registration and login every time.
 */
public class ApiTestClient {

    private static final String PASSWORD = "a-long-enough-password";

    private final MockMvc mockMvc;
    private final ObjectMapper objectMapper;

    public ApiTestClient(MockMvc mockMvc, ObjectMapper objectMapper) {
        this.mockMvc = mockMvc;
        this.objectMapper = objectMapper;
    }

    public String registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Adams Alves", "email", email, "password", PASSWORD))))
                .andExpect(status().isCreated());

        String body = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(body).path("token").asText();
    }

    public long createOrder(String token) throws Exception {
        return createOrder(token, "Joana Ribeiro");
    }

    /**
     * Naming the customer is what lets a test tell one order from another, which anything about the
     * order they come back in needs.
     */
    public long createOrder(String token, String customerName) throws Exception {
        String body = mockMvc.perform(post("/api/orders")
                        .header(AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName",
                                customerName,
                                "deliveryAddress",
                                "Rua das Flores, 128",
                                "items",
                                List.of(Map.of("name", "Pizza margherita", "quantity", 1, "unitPrice", "45.90"))))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(body).path("id").asLong();
    }
}
