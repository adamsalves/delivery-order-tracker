package dev.adamsalves.ordertracker.order;

import dev.adamsalves.ordertracker.order.dto.CreateOrderRequest;
import dev.adamsalves.ordertracker.order.dto.OrderDetailResponse;
import dev.adamsalves.ordertracker.order.dto.OrderSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
class OrderController {

    private final OrderService orderService;

    OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OrderDetailResponse create(@Valid @RequestBody CreateOrderRequest request) {
        return orderService.create(request);
    }

    @GetMapping("/{id}")
    OrderDetailResponse findById(@PathVariable Long id) {
        return orderService.findById(id);
    }

    /**
     * Returns a PagedModel rather than the Page itself: the JSON produced by PageImpl is not a
     * stable contract and Spring warns about serialising it directly.
     */
    @GetMapping
    PagedModel<OrderSummaryResponse> findAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return new PagedModel<>(orderService.findAll(pageable));
    }
}
