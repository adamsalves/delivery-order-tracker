package dev.adamsalves.ordertracker.order.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateOrderItemRequest(
        @NotBlank @Size(max = 255) String name,
        @Positive int quantity,

        @NotNull @Positive @Digits(integer = 10, fraction = 2)
        BigDecimal unitPrice) {}
