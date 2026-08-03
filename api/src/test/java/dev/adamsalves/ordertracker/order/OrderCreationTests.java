package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.math.BigDecimal;
import java.util.Collections;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * What comes back from a create, and what is still there when the order is read again. The suite
 * created orders as fixture setup all along and never looked at the answer, so the one thing a
 * client sees first was the least covered.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/order-creation.db")
class OrderCreationTests {

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

    @BeforeEach
    void startFromEmptyTables() throws Exception {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
        userRepository.deleteAll();

        token = new ApiTestClient(mockMvc, objectMapper).registerAndLogin(EMAIL);
    }

    @Test
    void answersTheCreatedOrderWithEverythingItWasGiven() throws Exception {
        create("""
                {
                  "customerName": "Joana Ribeiro",
                  "deliveryAddress": "Rua das Flores, 128",
                  "items": [
                    {"name": "Pizza margherita", "quantity": 2, "unitPrice": "45.90"},
                    {"name": "Refrigerante 2L", "quantity": 1, "unitPrice": "12.00"}
                  ]
                }""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.customerName").value("Joana Ribeiro"))
                .andExpect(jsonPath("$.deliveryAddress").value("Rua das Flores, 128"))
                .andExpect(jsonPath("$.createdAt").exists())
                .andExpect(jsonPath("$.updatedAt").exists())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").isNumber())
                .andExpect(jsonPath("$.items[0].name").value("Pizza margherita"))
                .andExpect(jsonPath("$.items[0].quantity").value(2))
                .andExpect(jsonPath("$.items[1].name").value("Refrigerante 2L"));
    }

    /**
     * The timeline reaches the client on the create itself, not only on the next read: the response
     * is built from the opening line the service just wrote, so a front end can draw the history
     * without asking again.
     */
    @Test
    void handsBackTheOpeningLineOfTheTimeline() throws Exception {
        create(oneItemAt("45.90"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RECEBIDO"))
                .andExpect(jsonPath("$.history.length()").value(1))
                .andExpect(jsonPath("$.history[0].fromStatus").doesNotExist())
                .andExpect(jsonPath("$.history[0].toStatus").value("RECEBIDO"))
                .andExpect(jsonPath("$.history[0].changedBy").value(EMAIL));
    }

    /**
     * The price is typed as a decimal literal in a string, because a JSON number would have gone
     * through a double before it ever left the browser and 45,90 is not 45.90 as a double. Coercing
     * that string into the BigDecimal the column stores is the hinge the whole money path hangs on,
     * on both sides of the wire — and the database is where it could quietly be lost, since SQLite
     * has no decimal type to hold the scale for us.
     */
    @Test
    void keepsEveryCentOfAPriceThroughTheDatabase() throws Exception {
        long id = idOf(create(oneItemAt("45.90")).andExpect(status().isCreated()));

        ResultActions read = mockMvc.perform(get("/api/orders/{id}", id).header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        assertThat(unitPriceOf(read)).isEqualByComparingTo(new BigDecimal("45.90"));
    }

    /**
     * A price that is a whole number of units has nothing after the point to keep it honest, so it
     * is the one most likely to come back as 12 and be read as twelve of something else.
     */
    @Test
    void keepsAPriceThatEndsInZeroCents() throws Exception {
        long id = idOf(create(oneItemAt("12.00")).andExpect(status().isCreated()));

        ResultActions read = mockMvc.perform(get("/api/orders/{id}", id).header(AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        assertThat(unitPriceOf(read)).isEqualByComparingTo(new BigDecimal("12.00"));
    }

    /**
     * The request carries no status on purpose: where an order starts is the server's call. A body
     * that names one anyway must not be able to open an order as delivered.
     */
    @Test
    void startsEveryOrderAtRecebidoWhateverTheBodySays() throws Exception {
        create("""
                {
                  "customerName": "Joana Ribeiro",
                  "deliveryAddress": "Rua das Flores, 128",
                  "status": "ENTREGUE",
                  "items": [{"name": "Pizza margherita", "quantity": 1, "unitPrice": "45.90"}]
                }""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("RECEBIDO"));
    }

    /**
     * The list had a floor and no ceiling, so an order of any length was accepted, stored and read
     * back in full. A refusal that still wrote the rows would leave the table holding what the
     * answer says was never taken.
     */
    @Test
    void refusesAnOrderCarryingMoreItemsThanTheCeiling() throws Exception {
        create(itemsRepeated(101))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.items").isArray());

        assertThat(orderRepository.count()).isZero();
    }

    @Test
    void takesAnOrderSittingExactlyOnTheCeiling() throws Exception {
        create(itemsRepeated(100))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items.length()").value(100));
    }

    private ResultActions create(String body) throws Exception {
        return mockMvc.perform(post("/api/orders")
                .header(AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private String oneItemAt(String unitPrice) {
        return """
                {
                  "customerName": "Joana Ribeiro",
                  "deliveryAddress": "Rua das Flores, 128",
                  "items": [{"name": "Pizza margherita", "quantity": 1, "unitPrice": "%s"}]
                }""".formatted(unitPrice);
    }

    private String itemsRepeated(int count) {
        String item = "{\"name\": \"Pizza margherita\", \"quantity\": 1, \"unitPrice\": \"45.90\"}";

        return """
                {
                  "customerName": "Joana Ribeiro",
                  "deliveryAddress": "Rua das Flores, 128",
                  "items": [%s]
                }""".formatted(String.join(",", Collections.nCopies(count, item)));
    }

    private long idOf(ResultActions result) throws Exception {
        return bodyOf(result).path("id").asLong();
    }

    private BigDecimal unitPriceOf(ResultActions result) throws Exception {
        return bodyOf(result).path("items").get(0).path("unitPrice").decimalValue();
    }

    private JsonNode bodyOf(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
