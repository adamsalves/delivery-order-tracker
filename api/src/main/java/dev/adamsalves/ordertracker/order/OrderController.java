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
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
    OrderDetailResponse create(@Valid @RequestBody CreateOrderRequest request, @AuthenticationPrincipal Jwt token) {
        return orderService.create(request, token.getClaimAsString("email"));
    }

    @GetMapping("/{id}")
    OrderDetailResponse findById(@PathVariable Long id) {
        return orderService.findById(id);
    }

    /**
     * Returns a PagedModel rather than the Page itself: the JSON produced by PageImpl is not a
     * stable contract and Spring warns about serialising it directly.
     *
     * <p>The id breaks ties on creation date, which the database stores with millisecond
     * resolution, so orders created within the same millisecond keep a stable order across pages.
     */
    @GetMapping
    PagedModel<OrderSummaryResponse> findAll(
            @PageableDefault(
                            size = 20,
                            sort = {"createdAt", "id"},
                            direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return new PagedModel<>(orderService.findAll(pageable));
    }
}
