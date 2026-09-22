package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.InvoiceDigestDelivery;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.UUID;

public interface InvoiceDigestDeliveryRepository extends JpaRepository<InvoiceDigestDelivery, UUID> {
    boolean existsByUserIdAndInvoiceDate(UUID userId, LocalDate invoiceDate);
}
