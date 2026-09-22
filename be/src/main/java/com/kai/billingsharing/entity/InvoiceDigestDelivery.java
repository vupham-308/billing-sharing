package com.kai.billingsharing.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invoice_digest_deliveries", uniqueConstraints =
        @UniqueConstraint(name = "uk_invoice_digest_user_date", columnNames = {"user_id", "invoice_date"}))
@Getter
@Setter
@NoArgsConstructor
public class InvoiceDigestDelivery {
    @Id
    private UUID id = UUID.randomUUID();
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.SENDING;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum Status { SENDING, ACCEPTED, UNKNOWN }
}
