package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.user.UserRepository;
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

    private ApiTestClient api;

    @BeforeEach
    void startFromEmptyTables() {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
        userRepository.deleteAll();

        api = new ApiTestClient(mockMvc, objectMapper);
    }

    /**
     * Without this line the timeline would begin at the first transition, and an order that has not
     * moved yet could not say when it arrived.
     */
    @Test
    void opensTheTimelineWhenTheOrderIsCreated() throws Exception {
        long orderId = api.createOrder(api.registerAndLogin(EMAIL));

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
        api.registerAndLogin(EMAIL);
        long orderId = api.createOrder(api.registerAndLogin("someone.else@example.com"));

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .singleElement()
                .extracting(OrderStatusHistory::getChangedBy)
                .isEqualTo("someone.else@example.com");
    }

    @Test
    void readsTheTimelineBackOldestFirstOnTheOrderDetail() throws Exception {
        String token = api.registerAndLogin(EMAIL);
        long orderId = api.createOrder(token);
        moveTo(orderId, "EM_PREPARO", token);

        mockMvc.perform(get("/api/orders/{id}", orderId).header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[0].fromStatus").doesNotExist())
                .andExpect(jsonPath("$.history[0].toStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$.history[0].changedBy").value(EMAIL))
                .andExpect(jsonPath("$.history[1].fromStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$.history[1].toStatus").value("EM_PREPARO"));
    }

    /**
     * The listing stays clear of it for the same reason it stays clear of the items: one extra
     * query per row on a page of orders.
     */
    @Test
    void keepsTheTimelineOutOfTheListing() throws Exception {
        String token = api.registerAndLogin(EMAIL);
        moveTo(api.createOrder(token), "EM_PREPARO", token);

        mockMvc.perform(get("/api/orders").header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("EM_PREPARO"))
                .andExpect(jsonPath("$.content[0].history").doesNotExist())
                .andExpect(jsonPath("$.content[0].items").doesNotExist());
    }

    private void moveTo(long orderId, String status, String token) throws Exception {
        mockMvc.perform(patch("/api/orders/{id}/status", orderId)
                        .header(AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status": "%s"}""".formatted(status)))
                .andExpect(status().isOk());
    }
}
