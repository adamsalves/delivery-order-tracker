package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
}
