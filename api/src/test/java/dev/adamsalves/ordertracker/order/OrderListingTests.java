package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.adamsalves.ordertracker.support.ApiTestClient;
import dev.adamsalves.ordertracker.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The listing is paginated and ordered by decision, not by accident: the whole table in one response
 * does not scale, and rows without an ORDER BY come back in whatever order the database finds
 * convenient. What the client sends is a request and not an instruction, so these cases are as much
 * about the page it asks for as about the one it gets when the ask is unusable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/order-listing.db")
class OrderListingTests {

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
    private String token;

    @BeforeEach
    void startFromEmptyTables() throws Exception {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
        userRepository.deleteAll();

        api = new ApiTestClient(mockMvc, objectMapper);
        token = api.registerAndLogin(EMAIL);
    }

    /**
     * The defaults are the contract for a client that asks for nothing, which is every client on its
     * first request. Newest first is the useful end of a delivery queue.
     */
    @Test
    void answersTwentyNewestFirstWhenTheClientAsksForNothing() throws Exception {
        List<Long> created = createOrders(3);

        ResultActions listed = list().andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(20))
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.page.totalElements").value(3))
                .andExpect(jsonPath("$.page.totalPages").value(1));

        assertThat(idsOf(listed)).containsExactlyElementsOf(created.reversed());
    }

    /**
     * A page size the caller picks is a page size the caller can use to ask for the whole table,
     * which is the one thing paginating was meant to prevent.
     */
    @ParameterizedTest
    @ValueSource(strings = {"101", "500", "100000"})
    void willNotHandOverMorePerPageThanTheCeilingAllows(String size) throws Exception {
        createOrders(3);

        list("size", size)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(100));
    }

    /**
     * A page of no rows and a page of minus one row are not pages. Falling back beats refusing here:
     * the request still has an obvious reading, and a listing is the wrong place to teach syntax.
     */
    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc"})
    void fallsBackToTheDefaultSizeWhenTheOneAskedForIsNotOne(String size) throws Exception {
        createOrders(3);

        list("size", size)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(20));
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "abc"})
    void fallsBackToTheFirstPageWhenTheOneAskedForIsNotOne(String page) throws Exception {
        createOrders(3);

        list("page", page)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.number").value(0))
                .andExpect(jsonPath("$.content.length()").value(3));
    }

    /**
     * Past the end is a legitimate place to stand — a client holding the fourth page while orders
     * are deleted arrives here — so it answers with an empty page rather than a refusal. The total
     * still counts the rows that exist, which is how the client finds its way back.
     */
    @Test
    void answersAnEmptyPagePastTheEndWithoutLosingCount() throws Exception {
        createOrders(3);

        list("page", "9999")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(0))
                .andExpect(jsonPath("$.page.number").value(9999))
                .andExpect(jsonPath("$.page.totalElements").value(3))
                .andExpect(jsonPath("$.page.totalPages").value(1));
    }

    /**
     * The point of paging is that the pages add up to the table. Ties on createdAt are what would
     * break that: the database keeps it to the millisecond, so orders created inside the same one
     * need the id to settle their order, or a row could sit on two pages and another on none.
     */
    @Test
    void splitsTheTableIntoPagesThatAddUpToIt() throws Exception {
        List<Long> created = createOrders(5);

        List<Long> walked = new ArrayList<>();
        walked.addAll(idsOf(list("page", "0", "size", "2")));
        walked.addAll(idsOf(list("page", "1", "size", "2")));
        walked.addAll(idsOf(list("page", "2", "size", "2")
                .andExpect(jsonPath("$.page.totalElements").value(5))
                .andExpect(jsonPath("$.page.totalPages").value(3))
                .andExpect(jsonPath("$.content.length()").value(1))));

        assertThat(walked).containsExactlyElementsOf(created.reversed());
    }

    @Test
    void turnsTheListingAroundWhenAskedToSortAscending() throws Exception {
        List<Long> created = createOrders(3);

        assertThat(idsOf(list("sort", "createdAt,asc").andExpect(status().isOk())))
                .containsExactlyElementsOf(created);
    }

    /**
     * Sorting by something other than the date shows the whitelist letting a property through rather
     * than only turning them away, and the sort reaching the query rather than being read and
     * dropped.
     */
    @Test
    void sortsByAnotherPropertyTheListingShows() throws Exception {
        api.createOrder(token, "Carlos Nunes");
        api.createOrder(token, "Ana Beatriz");
        api.createOrder(token, "Bruno Dias");

        list("sort", "customerName,asc")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].customerName").value("Ana Beatriz"))
                .andExpect(jsonPath("$.content[1].customerName").value("Bruno Dias"))
                .andExpect(jsonPath("$.content[2].customerName").value("Carlos Nunes"));
    }

    /**
     * An unknown property would reach the query and come back as a 500, and a to-many association
     * would join without distinct — an order on two pages and a total that changes between requests.
     * The shape of the refusal belongs to ApiErrorResponseTests; what these pin is that the guard
     * covers a path into the association and not only its bare name.
     */
    @ParameterizedTest
    @ValueSource(strings = {"items", "items.name", "somethingNobodyMapped"})
    void refusesToSortByAnythingTheListingDoesNotShow(String property) throws Exception {
        list("sort", property).andExpect(status().isBadRequest());
    }

    /**
     * A direction it cannot parse is read as a second property to sort by, so this reaches the guard
     * as an unknown property and is turned down for a reason that names the wrong thing. The status
     * is the part worth pinning: whatever the message ends up saying, an unusable direction must not
     * be sorted by and must not reach the query.
     */
    @Test
    void refusesADirectionItCannotRead() throws Exception {
        list("sort", "createdAt,sideways").andExpect(status().isBadRequest());
    }

    private List<Long> createOrders(int count) throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int index = 1; index <= count; index++) {
            ids.add(api.createOrder(token, "Cliente " + index));
        }

        return ids;
    }

    private List<Long> idsOf(ResultActions listed) throws Exception {
        JsonNode content = objectMapper
                .readTree(listed.andReturn().getResponse().getContentAsString())
                .path("content");

        List<Long> ids = new ArrayList<>();
        content.forEach(order -> ids.add(order.path("id").asLong()));

        return ids;
    }

    private ResultActions list() throws Exception {
        return mockMvc.perform(get("/api/orders").header(AUTHORIZATION, "Bearer " + token));
    }

    private ResultActions list(String name, String value) throws Exception {
        return mockMvc.perform(
                get("/api/orders").header(AUTHORIZATION, "Bearer " + token).param(name, value));
    }

    private ResultActions list(String name, String value, String otherName, String otherValue) throws Exception {
        return mockMvc.perform(get("/api/orders")
                .header(AUTHORIZATION, "Bearer " + token)
                .param(name, value)
                .param(otherName, otherValue));
    }
}
