package com.kai.billingsharing.entity;

import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Nationalized;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "email_outbox",
    indexes = {
        @Index(name = "UQ_email_outbox_business_key", columnList = "business_key", unique = true),
        @Index(name = "IX_email_outbox_status_retry", columnList = "status, next_retry_at"),
        @Index(name = "IX_email_outbox_provider_msg_id", columnList = "provider_message_id"),
        @Index(name = "IX_email_outbox_business_date", columnList = "business_date")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmailOutbox {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private EmailType type;

    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;

    @Nationalized
    @Column(name = "recipient_name")
    private String recipientName;

    @Nationalized
    @Column(name = "subject", nullable = false, length = 500)
    private String subject;

    @Nationalized
    @Column(name = "html_content", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String htmlContent;

    @Nationalized
    @Column(name = "payload_json", columnDefinition = "NVARCHAR(MAX)")
    private String payloadJson;

    @Column(name = "business_key", nullable = false, unique = true, length = 190)
    private String businessKey;

    @Column(name = "business_date", nullable = false)
    private LocalDate businessDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 32)
    private OutboxStatus status = OutboxStatus.PENDING;

    @Builder.Default
    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Builder.Default
    @Column(name = "max_retries", nullable = false)
    private Integer maxRetries = 3;

    @Column(name = "next_retry_at")
    private LocalDateTime nextRetryAt;

    @Builder.Default
    @Column(name = "http_call_initiated", nullable = false)
    private Boolean httpCallInitiated = false;

    @Column(name = "attempt_started_at")
    private LocalDateTime attemptStartedAt;

    @Nationalized
    @Column(name = "last_error", columnDefinition = "NVARCHAR(MAX)")
    private String lastError;

    @Column(name = "provider_message_id")
    private String providerMessageId;

    @Column(name = "delivery_status", length = 32)
    private String deliveryStatus;

    @Version
    @Builder.Default
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
