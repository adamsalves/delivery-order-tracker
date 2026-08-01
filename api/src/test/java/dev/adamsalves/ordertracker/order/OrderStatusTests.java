package dev.adamsalves.ordertracker.order;

import static dev.adamsalves.ordertracker.order.OrderStatus.CANCELADO;
import static dev.adamsalves.ordertracker.order.OrderStatus.EM_PREPARO;
import static dev.adamsalves.ordertracker.order.OrderStatus.ENTREGUE;
import static dev.adamsalves.ordertracker.order.OrderStatus.RECEBIDO;
import static dev.adamsalves.ordertracker.order.OrderStatus.SAIU_PARA_ENTREGA;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class OrderStatusTests {

    @Test
    void movesForwardOneStepAtATime() {
        assertThat(RECEBIDO.allowedTransitions()).containsExactlyInAnyOrder(EM_PREPARO, CANCELADO);
        assertThat(EM_PREPARO.allowedTransitions()).containsExactlyInAnyOrder(SAIU_PARA_ENTREGA, CANCELADO);
        assertThat(SAIU_PARA_ENTREGA.allowedTransitions()).containsExactlyInAnyOrder(ENTREGUE, CANCELADO);
    }

    @ParameterizedTest
    @EnumSource(names = {"ENTREGUE", "CANCELADO"})
    void leadsNowhereOnceTheOrderIsSettled(OrderStatus terminal) {
        assertThat(terminal.allowedTransitions()).isEmpty();
    }

    @ParameterizedTest
    @EnumSource
    void refusesToStandStill(OrderStatus status) {
        assertThat(status.canTransitionTo(status)).isFalse();
    }

    /**
     * The step that is skipped rather than taken out of order: the one an impatient client would
     * try when a delivery is already on its way out.
     */
    @Test
    void refusesToSkipAStep() {
        assertThat(EM_PREPARO.canTransitionTo(ENTREGUE)).isFalse();
        assertThat(RECEBIDO.canTransitionTo(SAIU_PARA_ENTREGA)).isFalse();
    }

    @Test
    void letsAnOrderBeCancelledUntilItIsSettled() {
        assertThat(RECEBIDO.canTransitionTo(CANCELADO)).isTrue();
        assertThat(EM_PREPARO.canTransitionTo(CANCELADO)).isTrue();
        assertThat(SAIU_PARA_ENTREGA.canTransitionTo(CANCELADO)).isTrue();
        assertThat(ENTREGUE.canTransitionTo(CANCELADO)).isFalse();
    }
}
