package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/order-status-transition.db")
class OrderStatusTransitionTests {

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

    private String token;
    private long orderId;

    @BeforeEach
    void startFromAFreshOrder() throws Exception {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
        userRepository.deleteAll();

        ApiTestClient api = new ApiTestClient(mockMvc, objectMapper);
        token = api.registerAndLogin(EMAIL);
        orderId = api.createOrder(token);
    }

    @Test
    void movesTheOrderOnAndWritesTheChangeDown() throws Exception {
        changeStatusTo(orderId, "EM_PREPARO")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_PREPARO"));

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .hasSize(2)
                .last()
                .satisfies(entry -> {
                    assertThat(entry.getFromStatus()).isEqualTo(OrderStatus.RECEBIDO);
                    assertThat(entry.getToStatus()).isEqualTo(OrderStatus.EM_PREPARO);
                    assertThat(entry.getChangedBy()).isEqualTo(EMAIL);
                });
    }

    /**
     * The refusal has to name the way out, or the caller learns the shape of the machine one
     * rejected request at a time.
     */
    @Test
    void refusesToSkipAStepAndSaysWhichOnesAreOpen() throws Exception {
        changeStatusTo(orderId, "EM_PREPARO").andExpect(status().isOk());

        ResultActions refused = changeStatusTo(orderId, "ENTREGUE")
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        assertThat(detailOf(refused))
                .contains("EM_PREPARO")
                .contains("ENTREGUE")
                .contains("SAIU_PARA_ENTREGA")
                .contains("CANCELADO");
    }

    @Test
    void refusesToStandStill() throws Exception {
        changeStatusTo(orderId, "RECEBIDO").andExpect(status().isConflict());

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .hasSize(1);
    }

    @Test
    void refusesToMoveAnOrderThatIsAlreadySettled() throws Exception {
        changeStatusTo(orderId, "EM_PREPARO").andExpect(status().isOk());
        changeStatusTo(orderId, "SAIU_PARA_ENTREGA").andExpect(status().isOk());
        changeStatusTo(orderId, "ENTREGUE").andExpect(status().isOk());

        ResultActions refused = changeStatusTo(orderId, "CANCELADO").andExpect(status().isConflict());

        assertThat(detailOf(refused)).contains("ENTREGUE").contains("final");
    }

    @Test
    void answersNotFoundForAnOrderThatDoesNotExist() throws Exception {
        changeStatusTo(orderId + 999, "EM_PREPARO")
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.title").value("Not Found"));
    }

    /**
     * Jackson gives up on the enum before the request reaches the controller, which without a hand
     * on it comes out as an unexplained 500.
     */
    @Test
    void turnsDownAStatusThatDoesNotExist() throws Exception {
        ResultActions refused = changeStatusTo(orderId, "VOANDO")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));

        assertThat(detailOf(refused)).contains("VOANDO").contains("RECEBIDO").contains("SAIU_PARA_ENTREGA");
    }

    @Test
    void turnsDownARequestThatNamesNoStatusAtAll() throws Exception {
        mockMvc.perform(patch("/api/orders/{id}/status", orderId)
                        .header(AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.status").exists());
    }

    private ResultActions changeStatusTo(long id, String status) throws Exception {
        return mockMvc.perform(patch("/api/orders/{id}/status", id)
                .header(AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"status": "%s"}""".formatted(status)));
    }

    private String detailOf(ResultActions result) throws Exception {
        String body = result.andReturn().getResponse().getContentAsString();

        return objectMapper.readTree(body).path("detail").asText();
    }
}
