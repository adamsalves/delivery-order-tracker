package dev.adamsalves.ordertracker.order;

import dev.adamsalves.ordertracker.order.dto.CreateOrderRequest;
import dev.adamsalves.ordertracker.order.dto.OrderDetailResponse;
import dev.adamsalves.ordertracker.order.dto.OrderSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrderService {

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
        return orderRepository.findAll(pageable).map(OrderSummaryResponse::from);
    }
}
