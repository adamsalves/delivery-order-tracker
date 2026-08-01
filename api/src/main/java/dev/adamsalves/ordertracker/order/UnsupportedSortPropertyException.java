package dev.adamsalves.ordertracker.order;

import java.util.Collection;

public class UnsupportedSortPropertyException extends RuntimeException {

    /**
     * The supported set is sorted on the way into the message for the same reason the transitions
     * are: an immutable Set iterates in an order that is salted per run, and a list of properties
     * that reshuffles between restarts is harder to compare against than it needs to be.
     */
    public UnsupportedSortPropertyException(String property, Collection<String> supported) {
        super("Cannot sort by %s, supported properties are %s"
                .formatted(property, supported.stream().sorted().toList()));
    }
}
