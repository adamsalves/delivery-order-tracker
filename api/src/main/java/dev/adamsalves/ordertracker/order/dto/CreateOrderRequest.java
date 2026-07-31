package dev.adamsalves.ordertracker.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Deliberately carries no status: every order starts as RECEBIDO, decided by the server.
 */
public record CreateOrderRequest(
        @NotBlank @Size(max = 255) String customerName,
        @NotBlank @Size(max = 255) String deliveryAddress,
        @NotEmpty List<@NotNull @Valid CreateOrderItemRequest> items) {}
