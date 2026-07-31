package dev.adamsalves.ordertracker.order;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderStatusHistoryRepository extends JpaRepository<OrderStatusHistory, Long> {

    /**
     * The id breaks ties on the moment of the change, which is stored to the millisecond, so two
     * transitions recorded within the same millisecond still read back in the order they happened.
     */
    List<OrderStatusHistory> findByOrderIdOrderByChangedAtAscIdAsc(Long orderId);
}
