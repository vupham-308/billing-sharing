package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.event.OutboxCreatedEvent;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailOutboxService {

    private final EmailOutboxRepository emailOutboxRepository;
    private final ApplicationEventPublisher eventPublisher;

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Lưu bản ghi email vào outbox với Propagation.REQUIRES_NEW.
     * Chống trùng lặp tuyệt đối qua businessKey.
     * Tự động phát OutboxCreatedEvent để worker gửi ngay lập tức sau khi transaction commit.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public EmailOutbox recordOutbox(
            EmailType type,
            String recipientEmail,
            String recipientName,
            String subject,
            String htmlContent,
            String payloadJson,
            String businessKey,
            LocalDate businessDate
    ) {
        if (emailOutboxRepository.existsByBusinessKey(businessKey)) {
            log.info("Email outbox với businessKey '{}' đã tồn tại, bỏ qua lưu trùng.", businessKey);
            return emailOutboxRepository.findByBusinessKey(businessKey).orElse(null);
        }

        LocalDate bDate = businessDate != null ? businessDate : LocalDate.now(VIETNAM_ZONE);

        EmailOutbox outbox = EmailOutbox.builder()
                .type(type)
                .recipientEmail(recipientEmail)
                .recipientName(recipientName)
                .subject(subject)
                .htmlContent(htmlContent)
                .payloadJson(payloadJson)
                .businessKey(businessKey)
                .businessDate(bDate)
                .status(OutboxStatus.PENDING)
                .retryCount(0)
                .maxRetries(3)
                .httpCallInitiated(false)
                .build();

        EmailOutbox saved = emailOutboxRepository.save(outbox);
        log.info("Đã ghi EmailOutbox id={}, type={}, businessKey={}", saved.getId(), type, businessKey);

        eventPublisher.publishEvent(new OutboxCreatedEvent(saved.getId()));
        return saved;
    }

    /**
     * Đánh dấu http_call_initiated = true trước khi mở socket HTTP tới Brevo.
     * Chạy trong transaction REQUIRES_NEW độc lập để commit ngay lập tức xuống DB.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markHttpInitiated(UUID outboxId) {
        emailOutboxRepository.findById(outboxId).ifPresent(outbox -> {
            outbox.setHttpCallInitiated(true);
            outbox.setAttemptStartedAt(LocalDateTime.now());
            emailOutboxRepository.save(outbox);
        });
    }

    /**
     * Admin hủy gửi một email outbox.
     */
    @Transactional
    public void cancelOutbox(UUID outboxId) {
        EmailOutbox outbox = emailOutboxRepository.findById(outboxId)
                .orElseThrow(() -> new AppException("Không tìm thấy email outbox với ID: " + outboxId, HttpStatus.NOT_FOUND));

        if (outbox.getStatus() == OutboxStatus.SENT) {
            throw new AppException("Email này đã được gửi thành công, không thể hủy.", HttpStatus.BAD_REQUEST);
        }

        outbox.setStatus(OutboxStatus.CANCELLED);
        emailOutboxRepository.save(outbox);
        log.info("Admin đã hủy email outbox id={}", outboxId);
    }

    /**
     * Admin chủ động bấm gửi lại cho mail UNKNOWN hoặc FAILED_PERMANENT.
     */
    @Transactional
    public void manualRetry(UUID outboxId) {
        EmailOutbox outbox = emailOutboxRepository.findById(outboxId)
                .orElseThrow(() -> new AppException("Không tìm thấy email outbox với ID: " + outboxId, HttpStatus.NOT_FOUND));

        outbox.setStatus(OutboxStatus.PENDING);
        outbox.setNextRetryAt(null);
        outbox.setRetryCount(0);
        outbox.setHttpCallInitiated(false);
        outbox.setLastError(null);
        EmailOutbox saved = emailOutboxRepository.save(outbox);
        log.info("Admin đã bấm gửi lại thủ công cho outbox id={}", outboxId);

        eventPublisher.publishEvent(new OutboxCreatedEvent(saved.getId()));
    }
}
