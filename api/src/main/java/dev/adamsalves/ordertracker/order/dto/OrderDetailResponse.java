package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.Order;
import dev.adamsalves.ordertracker.order.OrderStatus;
import dev.adamsalves.ordertracker.order.OrderStatusHistory;
import java.time.Instant;
import java.util.List;

public record OrderDetailResponse(
        Long id,
        String customerName,
        String deliveryAddress,
        OrderStatus status,
        Instant createdAt,
        Instant updatedAt,
        List<OrderItemResponse> items,
        List<OrderStatusHistoryResponse> history) {

    /**
     * The timeline is handed in rather than read off the order, because it is not mapped as an
     * association: the caller is the one that knows to ask for it in the order it happened.
     */
    public static OrderDetailResponse from(Order order, List<OrderStatusHistory> history) {
        return new OrderDetailResponse(
                order.getId(),
                order.getCustomerName(),
                order.getDeliveryAddress(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                order.getItems().stream().map(OrderItemResponse::from).toList(),
                history.stream().map(OrderStatusHistoryResponse::from).toList());
    }
}
