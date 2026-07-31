package dev.adamsalves.ordertracker.order;

public class OrderNotFoundException extends RuntimeException {

    public OrderNotFoundException(Long id) {
        super("Order " + id + " not found");
    }
}
