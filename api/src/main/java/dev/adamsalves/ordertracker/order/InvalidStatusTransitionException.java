package dev.adamsalves.ordertracker.order;

import java.util.Set;

public class InvalidStatusTransitionException extends RuntimeException {

    public InvalidStatusTransitionException(OrderStatus current, OrderStatus requested) {
        super(explain(current, requested));
    }

    /**
     * The way out is spelled out, so the caller does not have to guess the shape of the machine one
     * rejected request at a time.
     *
     * <p>Sorted because an immutable Set iterates in an order that is not only unspecified but
     * salted per run, and a message that reshuffles itself between restarts is a poor thing to read
     * from a log.
     */
    private static String explain(OrderStatus current, OrderStatus requested) {
        Set<OrderStatus> allowed = current.allowedTransitions();

        if (allowed.isEmpty()) {
            return "Cannot change status from %s to %s: %s is final and allows no further transitions"
                    .formatted(current, requested, current);
        }

        return "Cannot change status from %s to %s, the transitions allowed from %s are %s"
                .formatted(
                        current, requested, current, allowed.stream().sorted().toList());
    }
}
