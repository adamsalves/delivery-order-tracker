package dev.adamsalves.ordertracker.order;

import java.util.Set;

public enum OrderStatus {
    RECEBIDO,
    EM_PREPARO,
    SAIU_PARA_ENTREGA,
    ENTREGUE,
    CANCELADO;

    /**
     * The table is read by a switch rather than held in a field: a constant cannot reference its
     * siblings while they are still being constructed, and the method body runs long after that.
     *
     * <p>No status lists itself, so standing still is refused by the same table that refuses a jump
     * over a step. Adding a self-entry here would quietly allow it.
     */
    public Set<OrderStatus> allowedTransitions() {
        return switch (this) {
            case RECEBIDO -> Set.of(EM_PREPARO, CANCELADO);
            case EM_PREPARO -> Set.of(SAIU_PARA_ENTREGA, CANCELADO);
            case SAIU_PARA_ENTREGA -> Set.of(ENTREGUE, CANCELADO);
            case ENTREGUE, CANCELADO -> Set.of();
        };
    }

    public boolean canTransitionTo(OrderStatus target) {
        return allowedTransitions().contains(target);
    }
}
