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

        /*
         * The list was bounded below and not above, so 20 000 items — a megabyte of body — came back
         * 201, were persisted, and were echoed back in full. The ceiling is the same 100 the page
         * size stops at, and for the same reason: past a hundred lines this is no longer an order
         * somebody is going to deliver.
         *
         * It refuses after Jackson has already built the list, which is as early as a constraint on
         * a field can be read. That bounds what is stored and what is answered, not what is parsed;
         * capping the bytes themselves belongs at the container and is not something a delivery
         * order needs to reach for.
         */
        @NotEmpty @Size(max = 100) List<@NotNull @Valid CreateOrderItemRequest> items) {}
