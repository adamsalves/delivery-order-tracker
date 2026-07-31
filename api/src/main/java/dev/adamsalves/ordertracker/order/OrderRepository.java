package dev.adamsalves.ordertracker.order;

import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    /**
     * Items are mapped lazily and open session in view is disabled, so the detail lookup has to
     * fetch them within the transaction that loads the order.
     */
    @EntityGraph(attributePaths = "items")
    Optional<Order> findWithItemsById(Long id);
}
