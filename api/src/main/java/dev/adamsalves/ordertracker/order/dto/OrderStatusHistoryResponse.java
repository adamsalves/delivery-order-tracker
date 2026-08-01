package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.OrderStatus;
import dev.adamsalves.ordertracker.order.OrderStatusHistory;
import java.time.Instant;

public record OrderStatusHistoryResponse(
        Long id, OrderStatus fromStatus, OrderStatus toStatus, Instant changedAt, String changedBy) {

    public static OrderStatusHistoryResponse from(OrderStatusHistory entry) {
        return new OrderStatusHistoryResponse(
                entry.getId(), entry.getFromStatus(), entry.getToStatus(), entry.getChangedAt(), entry.getChangedBy());
    }
}
