package dev.adamsalves.ordertracker.order;

import dev.adamsalves.ordertracker.order.dto.CreateOrderRequest;
import dev.adamsalves.ordertracker.order.dto.OrderDetailResponse;
import dev.adamsalves.ordertracker.order.dto.OrderSummaryResponse;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final Set<String> SORTABLE_PROPERTIES =
            Set.of("id", "customerName", "deliveryAddress", "status", "createdAt");

    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository statusHistoryRepository;

    public OrderService(OrderRepository orderRepository, OrderStatusHistoryRepository statusHistoryRepository) {
        this.orderRepository = orderRepository;
        this.statusHistoryRepository = statusHistoryRepository;
    }

    /**
     * The timeline is opened here rather than on the first transition, so that an order that has
     * never moved still says when it arrived and who took it.
     */
    @Transactional
    public OrderDetailResponse create(CreateOrderRequest request, String changedBy) {
        Order order = new Order(request.customerName(), request.deliveryAddress());
        request.items().forEach(item -> order.addItem(new OrderItem(item.name(), item.quantity(), item.unitPrice())));

        Order saved = orderRepository.save(order);
        OrderStatusHistory opening =
                statusHistoryRepository.save(new OrderStatusHistory(saved, null, saved.getStatus(), changedBy));

        return OrderDetailResponse.from(saved, List.of(opening));
    }

    /**
     * Flushed before the response is built: the status change alone would only reach the database
     * when the transaction commits, and the timestamp that PreUpdate stamps on the way out would
     * still be the old one by the time it was read back into the body.
     */
    @Transactional
    public OrderDetailResponse updateStatus(Long id, OrderStatus target, String changedBy) {
        Order order = orderRepository.findWithItemsById(id).orElseThrow(() -> new OrderNotFoundException(id));

        OrderStatus previous = order.getStatus();
        order.transitionTo(target);

        Order updated = orderRepository.saveAndFlush(order);
        statusHistoryRepository.save(new OrderStatusHistory(updated, previous, target, changedBy));

        return detailOf(updated);
    }

    @Transactional(readOnly = true)
    public OrderDetailResponse findById(Long id) {
        return orderRepository
                .findWithItemsById(id)
                .map(this::detailOf)
                .orElseThrow(() -> new OrderNotFoundException(id));
    }

    private OrderDetailResponse detailOf(Order order) {
        return OrderDetailResponse.from(
                order, statusHistoryRepository.findByOrderIdOrderByChangedAtAscIdAsc(order.getId()));
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
                    throw new UnsupportedSortPropertyException(property, SORTABLE_PROPERTIES);
                });
    }
}
