package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.Order;
import dev.adamsalves.ordertracker.order.OrderStatus;
import java.time.Instant;

/**
 * Listing projection. It leaves items out on purpose: touching the lazy association inside a loop
 * over a page of orders would trigger one extra query per order.
 */
public record OrderSummaryResponse(
        Long id, String customerName, String deliveryAddress, OrderStatus status, Instant createdAt) {

    public static OrderSummaryResponse from(Order order) {
        return new OrderSummaryResponse(
                order.getId(),
                order.getCustomerName(),
                order.getDeliveryAddress(),
                order.getStatus(),
                order.getCreatedAt());
    }
}
