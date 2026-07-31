package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.Order;
import dev.adamsalves.ordertracker.order.OrderStatus;
import java.time.Instant;
import java.util.List;

public record OrderDetailResponse(
        Long id,
        String customerName,
        String deliveryAddress,
        OrderStatus status,
        Instant createdAt,
        Instant updatedAt,
        List<OrderItemResponse> items) {

    public static OrderDetailResponse from(Order order) {
        return new OrderDetailResponse(
                order.getId(),
                order.getCustomerName(),
                order.getDeliveryAddress(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getItems().stream().map(OrderItemResponse::from).toList());
    }
}
