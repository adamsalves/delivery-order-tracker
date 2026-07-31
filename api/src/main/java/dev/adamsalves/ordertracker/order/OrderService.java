package dev.adamsalves.ordertracker.order;

import dev.adamsalves.ordertracker.order.dto.CreateOrderRequest;
import dev.adamsalves.ordertracker.order.dto.OrderDetailResponse;
import dev.adamsalves.ordertracker.order.dto.OrderSummaryResponse;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderService {

    private static final Set<String> SORTABLE_PROPERTIES =
            Set.of("id", "customerName", "deliveryAddress", "status", "createdAt");

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional
    public OrderDetailResponse create(CreateOrderRequest request) {
        Order order = new Order(request.customerName(), request.deliveryAddress());
        request.items().forEach(item -> order.addItem(new OrderItem(item.name(), item.quantity(), item.unitPrice())));

        return OrderDetailResponse.from(orderRepository.save(order));
    }

    @Transactional(readOnly = true)
    public OrderDetailResponse findById(Long id) {
        return orderRepository
                .findWithItemsById(id)
                .map(OrderDetailResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order " + id + " not found"));
    }

    @Transactional(readOnly = true)
    public Page<OrderSummaryResponse> findAll(Pageable pageable) {
        rejectUnsupportedSort(pageable.getSort());

        return orderRepository.findAll(pageable).map(OrderSummaryResponse::from);
    }

    /**
     * Sorting is limited to the scalar properties the listing exposes. An unknown property would
     * otherwise reach the query and fail with 500, and sorting by the items association would join
     * a to-many relation without distinct, so an order could show up on more than one page and the
     * total element count would change between requests.
     */
    private void rejectUnsupportedSort(Sort sort) {
        sort.stream()
                .map(Sort.Order::getProperty)
                .filter(property -> !SORTABLE_PROPERTIES.contains(property))
                .findFirst()
                .ifPresent(property -> {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Cannot sort by " + property + ", supported properties are " + SORTABLE_PROPERTIES);
                });
    }
}
