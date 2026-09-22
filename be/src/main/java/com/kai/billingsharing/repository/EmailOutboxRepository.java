package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmailOutboxRepository extends JpaRepository<EmailOutbox, UUID>, JpaSpecificationExecutor<EmailOutbox> {

    boolean existsByBusinessKey(String businessKey);

    Optional<EmailOutbox> findByBusinessKey(String businessKey);

    Optional<EmailOutbox> findByProviderMessageId(String providerMessageId);

    @Query("SELECT o FROM EmailOutbox o WHERE o.status = :status AND o.type IN :types AND (o.nextRetryAt IS NULL OR o.nextRetryAt <= :now) ORDER BY o.createdAt ASC")
    List<EmailOutbox> findRetryPendingByTypeIn(
            @Param("status") OutboxStatus status,
            @Param("types") Collection<EmailType> types,
            @Param("now") LocalDateTime now
    );

    @Query("SELECT o FROM EmailOutbox o WHERE o.status = 'PROCESSING' AND o.attemptStartedAt <= :threshold ORDER BY o.attemptStartedAt ASC")
    List<EmailOutbox> findStuckProcessing(@Param("threshold") LocalDateTime threshold);

    @Query("SELECT COUNT(o) > 0 FROM EmailOutbox o WHERE o.type = :type AND o.recipientEmail = :email AND o.businessDate = :businessDate AND o.status = 'SENT'")
    boolean hasSuccessfulEmailToday(
            @Param("type") EmailType type,
            @Param("email") String email,
            @Param("businessDate") LocalDate businessDate
    );

    @Modifying
    @Query("UPDATE EmailOutbox o SET o.status = 'PROCESSING', o.attemptStartedAt = :now WHERE o.id = :id AND o.status IN ('PENDING', 'RETRY_PENDING')")
    int markProcessingIfPendingOrRetry(@Param("id") UUID id, @Param("now") LocalDateTime now);

    @Modifying
    @Query("UPDATE EmailOutbox o SET o.status = :newStatus, o.providerMessageId = :messageId, o.lastError = :lastError, o.processedAt = :processedAt, o.updatedAt = :now WHERE o.id = :id AND o.status = 'PROCESSING'")
    int updateStatusIfProcessing(
            @Param("id") UUID id,
            @Param("newStatus") OutboxStatus newStatus,
            @Param("messageId") String messageId,
            @Param("lastError") String lastError,
            @Param("processedAt") LocalDateTime processedAt,
            @Param("now") LocalDateTime now
    );

    @Modifying
    @Query("UPDATE EmailOutbox o SET o.status = :newStatus, o.retryCount = :retryCount, o.nextRetryAt = :nextRetryAt, o.lastError = :lastError, o.updatedAt = :now WHERE o.id = :id AND o.status = 'PROCESSING'")
    int updateRetryIfProcessing(
            @Param("id") UUID id,
            @Param("newStatus") OutboxStatus newStatus,
            @Param("retryCount") Integer retryCount,
            @Param("nextRetryAt") LocalDateTime nextRetryAt,
            @Param("lastError") String lastError,
            @Param("now") LocalDateTime now
    );

    Page<EmailOutbox> findByStatusOrderByCreatedAtDesc(OutboxStatus status, Pageable pageable);
}
