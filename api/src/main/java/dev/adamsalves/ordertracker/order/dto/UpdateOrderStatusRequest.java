package dev.adamsalves.ordertracker.order.dto;

import dev.adamsalves.ordertracker.order.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusRequest(@NotNull OrderStatus status) {}
