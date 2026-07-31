package dev.adamsalves.ordertracker.order;

import static org.assertj.core.api.Assertions.assertThat;

import dev.adamsalves.ordertracker.order.dto.CreateOrderItemRequest;
import dev.adamsalves.ordertracker.order.dto.CreateOrderRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Two callers moving the same order at once must meet the state machine, not the database's own
 * locking. Updating a status reads the order before it writes it, and SQLite refuses to promote a
 * transaction that has already read into one that writes — refuses it without waiting, so the
 * losing caller used to get a 500 that said nothing about the order. Beginning every transaction
 * IMMEDIATE serialises the two, which leaves the transition table as the only thing that can turn
 * a caller down.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.datasource.url=jdbc:sqlite:./target/test-data/concurrent-status-transition.db")
class ConcurrentStatusTransitionTests {

    private static final int CALLERS = 8;
    private static final String EMAIL = "adams@example.com";

    @Autowired
    private OrderService orderService;

    @Autowired
    private OrderStatusHistoryRepository statusHistoryRepository;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void startFromEmptyTables() {
        statusHistoryRepository.deleteAll();
        orderRepository.deleteAll();
    }

    @Test
    void letsOneCallerThroughAndTurnsTheRestDownOnTheStateMachine() throws Exception {
        long orderId = orderService.create(anOrder(), EMAIL).id();

        List<Throwable> refusals = moveConcurrently(orderId, OrderStatus.EM_PREPARO);

        assertThat(refusals)
                .hasSize(CALLERS - 1)
                .allSatisfy(refusal -> assertThat(refusal).isInstanceOf(InvalidStatusTransitionException.class));
        assertThat(orderService.findById(orderId).status()).isEqualTo(OrderStatus.EM_PREPARO);
    }

    /**
     * The timeline has to agree with what happened: one move went through, so the opening line and
     * a single transition after it.
     */
    @Test
    void recordsOnlyTheMoveThatWentThrough() throws Exception {
        long orderId = orderService.create(anOrder(), EMAIL).id();

        moveConcurrently(orderId, OrderStatus.EM_PREPARO);

        assertThat(statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(orderId))
                .hasSize(2)
                .last()
                .satisfies(entry -> {
                    assertThat(entry.getFromStatus()).isEqualTo(OrderStatus.RECEBIDO);
                    assertThat(entry.getToStatus()).isEqualTo(OrderStatus.EM_PREPARO);
                });
    }

    /**
     * Released together so the attempts overlap inside the window that used to break: between the
     * read and the write of the same transaction.
     */
    private List<Throwable> moveConcurrently(long orderId, OrderStatus target) throws Exception {
        CountDownLatch ready = new CountDownLatch(CALLERS);
        CountDownLatch go = new CountDownLatch(1);
        ExecutorService callers = Executors.newFixedThreadPool(CALLERS);

        try {
            List<Future<Throwable>> attempts = new ArrayList<>();
            for (int caller = 0; caller < CALLERS; caller++) {
                attempts.add(callers.submit(() -> {
                    ready.countDown();
                    go.await();
                    try {
                        orderService.updateStatus(orderId, target, EMAIL);
                        return null;
                    } catch (Throwable refusal) {
                        return refusal;
                    }
                }));
            }

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            go.countDown();

            List<Throwable> refusals = new ArrayList<>();
            for (Future<Throwable> attempt : attempts) {
                Throwable refusal = attempt.get(30, TimeUnit.SECONDS);
                if (refusal != null) {
                    refusals.add(refusal);
                }
            }

            return refusals;
        } finally {
            callers.shutdownNow();
        }
    }

    private CreateOrderRequest anOrder() {
        return new CreateOrderRequest(
                "Adams Alves",
                "Rua das Flores, 100",
                List.of(new CreateOrderItemRequest("Pizza", 1, new BigDecimal("49.90"))));
    }
}
