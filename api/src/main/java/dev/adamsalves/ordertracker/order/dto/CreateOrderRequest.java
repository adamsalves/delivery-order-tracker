package dev.adamsalves.ordertracker.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Deliberately carries no status: every order starts as RECEBIDO, decided by the server.
 */
public record CreateOrderRequest(
        @NotBlank String customerName,
        @NotBlank String deliveryAddress,
        @NotEmpty List<@NotNull @Valid CreateOrderItemRequest> items) {}
