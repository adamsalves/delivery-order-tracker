package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.OrderItem;
import java.math.BigDecimal;

public record OrderItemResponse(Long id, String name, int quantity, BigDecimal unitPrice) {

    public static OrderItemResponse from(OrderItem item) {
        return new OrderItemResponse(item.getId(), item.getName(), item.getQuantity(), item.getUnitPrice());
    }
}
