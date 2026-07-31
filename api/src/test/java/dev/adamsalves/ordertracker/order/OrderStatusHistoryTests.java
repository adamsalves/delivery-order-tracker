package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.user.UserRepository;
import java.util.List;
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
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/order-status-history.db")
class OrderStatusHistoryTests {

    private static final String EMAIL = "adams@example.com";
    private static final String PASSWORD = "a-long-enough-password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OrderStatusHistoryRepository statusHistoryRepository;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void startFromEmptyTables() {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
        userRepository.deleteAll();
    }

    /**
     * Without this line the timeline would begin at the first transition, and an order that has not
     * moved yet could not say when it arrived.
     */
    @Test
    void opensTheTimelineWhenTheOrderIsCreated() throws Exception {
        long orderId = createOrder(registerAndLogin(EMAIL));

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .singleElement()
                .satisfies(entry -> {
                    assertThat(entry.getFromStatus()).isNull();
                    assertThat(entry.getToStatus()).isEqualTo(OrderStatus.RECEBIDO);
                    assertThat(entry.getChangedBy()).isEqualTo(EMAIL);
                    assertThat(entry.getChangedAt()).isNotNull();
                });
    }

    /**
     * The author has to come from the token that authorised the call, not from whoever registered
     * first.
     */
    @Test
    void attributesTheOpeningLineToTheCallerThatCreatedTheOrder() throws Exception {
        registerAndLogin(EMAIL);
        long orderId = createOrder(registerAndLogin("someone.else@example.com"));

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .singleElement()
                .extracting(OrderStatusHistory::getChangedBy)
                .isEqualTo("someone.else@example.com");
    }

    private long createOrder(String token) throws Exception {
        String body = mockMvc.perform(post("/api/orders")
                        .header(AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "customerName",
                                "Joana Ribeiro",
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

    private String registerAndLogin(String email) throws Exception {
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
}
