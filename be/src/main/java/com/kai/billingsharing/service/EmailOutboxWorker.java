package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.PaymentRequest;
import com.kai.billingsharing.entity.Token;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.event.OutboxCreatedEvent;
import com.kai.billingsharing.exception.BrevoApiException;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import com.kai.billingsharing.repository.PaymentRequestRepository;
import com.kai.billingsharing.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.net.SocketTimeoutException;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpTimeoutException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailOutboxWorker {

    private final EmailOutboxRepository emailOutboxRepository;
    private final EmailOutboxService emailOutboxService;
    private final EmailService emailService;
    private final PaymentRequestRepository paymentRequestRepository;
    private final TokenRepository tokenRepository;
    private final StuckJobRecoveryService stuckJobRecoveryService;
    private final TaskScheduler taskScheduler;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /**
     * Lắng nghe sự kiện tạo Outbox sau khi transaction nghiệp vụ commit thành công.
     * Chạy bất đồng bộ, Zero Continuous Polling.
     */
    @Async("taskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onOutboxCreated(OutboxCreatedEvent event) {
        log.info("Nhận sự kiện OutboxCreatedEvent cho id={}. Kích hoạt xử lý gửi email...", event.outboxId());
        processOutboxAsync(event.outboxId());
    }

    /**
     * Luồng bất đồng bộ gửi email ra mạng ngoài Brevo.
     */
    @Async("taskExecutor")
    @Transactional
    public void processOutboxAsync(UUID outboxId) {
        LocalDateTime now = LocalDateTime.now();
        // 1. Khóa hàng an toàn: Chỉ nhận bản ghi PENDING hoặc RETRY_PENDING
        int locked = emailOutboxRepository.markProcessingIfPendingOrRetry(outboxId, now);
        if (locked == 0) {
            log.debug("Outbox id={} không ở trạng thái chờ xử lý (đã được worker khác nhận hoặc đã hoàn tất).", outboxId);
            return;
        }

        EmailOutbox outbox = emailOutboxRepository.findById(outboxId).orElse(null);
        if (outbox == null) {
            log.warn("Không tìm thấy outbox id={} sau khi lock.", outboxId);
            return;
        }

        // 2. Just-In-Time Validation (Kiểm tra dữ liệu DB tức thời trước khi gửi)
        if (shouldSkipOutbox(outbox)) {
            return;
        }

        // 3. Commit httpCallInitiated = true độc lập qua REQUIRES_NEW trước khi mở socket HTTP
        emailOutboxService.markHttpInitiated(outboxId);

        // 4. Gửi email qua Brevo API với Correlation Tag
        List<String> tags = List.of("outbox-" + outboxId.toString());
        try {
            String messageId = emailService.sendBrevoEmailRaw(
                    outbox.getRecipientEmail(),
                    outbox.getRecipientName(),
                    outbox.getSubject(),
                    outbox.getHtmlContent(),
                    tags
            );

            // 5. Cập nhật thành công có điều kiện (WHERE status = 'PROCESSING')
            // Chống worker đè Webhook nếu Webhook đến cực sớm
            emailOutboxRepository.updateStatusIfProcessing(
                    outboxId,
                    OutboxStatus.SENT,
                    messageId,
                    null,
                    LocalDateTime.now(),
                    LocalDateTime.now()
            );
            log.info("Đã gửi email thành công outboxId={}, brevoMessageId={}", outboxId, messageId);

        } catch (BrevoApiException e) {
            int statusCode = e.getStatusCode();
            String errorMsg = "Brevo HTTP " + statusCode + ": " + e.getResponseBody();
            log.error("Lỗi Brevo API khi gửi outboxId {}: {}", outboxId, errorMsg);

            if (statusCode >= 400 && statusCode < 500 && statusCode != 429) {
                // Lỗi client (400, 401, 403, 404) -> vĩnh viễn, không retry
                emailOutboxRepository.updateStatusIfProcessing(
                        outboxId,
                        OutboxStatus.FAILED_PERMANENT,
                        null,
                        errorMsg,
                        LocalDateTime.now(),
                        LocalDateTime.now()
                );
            } else {
                // Rate limit (429) hoặc lỗi server Brevo (5xx) -> Lỗi tạm thời, thực hiện retry
                handleTransientFailure(outbox, errorMsg);
            }
        } catch (Exception e) {
            log.error("Lỗi mạng khi gửi outboxId {}: {}", outboxId, e.getMessage(), e);
            if (isReadTimeout(e)) {
                // Socket Read Timeout: Brevo có thể đã nhận được mail, không rõ ràng -> Bắt buộc gán UNKNOWN
                log.warn("Socket Read Timeout cho outboxId {}. Chuyển trạng thái UNKNOWN chờ Brevo webhook đối soát.", outboxId);
                emailOutboxRepository.updateStatusIfProcessing(
                        outboxId,
                        OutboxStatus.UNKNOWN,
                        null,
                        "Socket Read Timeout: " + e.getMessage(),
                        null,
                        LocalDateTime.now()
                );
            } else {
                // Connect timeout hoặc lỗi mạng trước khi truyền dữ liệu -> An toàn retry
                handleTransientFailure(outbox, e.getMessage());
            }
        }
    }

    /**
     * Kiểm tra tính hợp lệ tức thời của email trước khi gửi (Just-In-Time Validation).
     * Trả về true nếu email bị hủy (SKIPPED).
     */
    private boolean shouldSkipOutbox(EmailOutbox outbox) {
        EmailType type = outbox.getType();

        // A. Kiểm tra Nhắc Nợ (DEBT_REMINDER)
        if (type == EmailType.DEBT_REMINDER) {
            LocalDate today = LocalDate.now(VIETNAM_ZONE);
            if (outbox.getBusinessDate().isBefore(today)) {
                markSkipped(outbox.getId(), "Bỏ qua nhắc nợ của ngày quá khứ sau downtime, chỉ gửi nhắc nợ cho ngày hiện tại.");
                return true;
            }

            if (outbox.getPayloadJson() != null && !outbox.getPayloadJson().isBlank()) {
                List<UUID> requestIds = parsePaymentRequestIds(outbox.getPayloadJson());
                if (!requestIds.isEmpty()) {
                    List<PaymentRequest> requests = paymentRequestRepository.findAllById(requestIds);
                    long pendingCount = requests.stream()
                            .filter(r -> r.getStatus() == PaymentRequestStatus.PENDING)
                            .count();
                    if (pendingCount == 0) {
                        markSkipped(outbox.getId(), "Tất cả khoản nợ đã được thanh toán trước khi gửi thư.");
                        return true;
                    }
                }
            }
        }

        // B. Kiểm tra Email Xác Thực & Quên Mật Khẩu
        if (type == EmailType.EMAIL_VERIFICATION || type == EmailType.PASSWORD_RESET) {
            if (outbox.getPayloadJson() != null && !outbox.getPayloadJson().isBlank()) {
                try {
                    JsonNode node = objectMapper.readTree(outbox.getPayloadJson());
                    if (node.has("tokenId")) {
                        UUID tokenId = UUID.fromString(node.get("tokenId").asText());
                        Token token = tokenRepository.findById(tokenId).orElse(null);
                        if (token == null || Boolean.TRUE.equals(token.getUsed()) || token.getExpiryDate().isBefore(LocalDateTime.now())) {
                            markSkipped(outbox.getId(), "Mã xác thực/đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.");
                            return true;
                        }
                        if (type == EmailType.EMAIL_VERIFICATION && Boolean.TRUE.equals(token.getUser().getIsActive())) {
                            markSkipped(outbox.getId(), "Tài khoản đã được kích hoạt thành công.");
                            return true;
                        }
                    }
                } catch (Exception e) {
                    log.debug("Không thể bóc tách payload token outbox {}: {}", outbox.getId(), e.getMessage());
                }
            }
        }

        return false;
    }

    private void markSkipped(UUID outboxId, String reason) {
        log.info("Email outbox id={} được đánh dấu SKIPPED: {}", outboxId, reason);
        emailOutboxRepository.updateStatusIfProcessing(
                outboxId,
                OutboxStatus.SKIPPED,
                null,
                reason,
                LocalDateTime.now(),
                LocalDateTime.now()
        );
    }

    /**
     * Xử lý lỗi tạm thời (Transient Failure): Connect Timeout, 429, 5xx.
     */
    private void handleTransientFailure(EmailOutbox outbox, String errorMsg) {
        int nextRetryCount = outbox.getRetryCount() + 1;
        UUID outboxId = outbox.getId();

        if (isRealTimeEmail(outbox.getType())) {
            // Nhóm Transactional: Exponential Backoff (30s, 60s, 120s, max 3 lần)
            if (nextRetryCount <= outbox.getMaxRetries()) {
                long backoffSeconds = (long) (30 * Math.pow(2, nextRetryCount - 1));
                LocalDateTime nextRetryAt = LocalDateTime.now().plusSeconds(backoffSeconds);

                emailOutboxRepository.updateRetryIfProcessing(
                        outboxId,
                        OutboxStatus.RETRY_PENDING,
                        nextRetryCount,
                        nextRetryAt,
                        errorMsg,
                        LocalDateTime.now()
                );

                log.info("Lên lịch retry tức thời cho outboxId {} sau {}s (lần {}/{})", outboxId, backoffSeconds, nextRetryCount, outbox.getMaxRetries());
                taskScheduler.schedule(() -> processOutboxAsync(outboxId), Instant.now().plusSeconds(backoffSeconds));
            } else {
                emailOutboxRepository.updateStatusIfProcessing(
                        outboxId,
                        OutboxStatus.FAILED_PERMANENT,
                        null,
                        "Vượt quá số lần thử lại tối đa (" + outbox.getMaxRetries() + "). Lỗi: " + errorMsg,
                        LocalDateTime.now(),
                        LocalDateTime.now()
                );
                log.warn("OutboxId {} vượt quá số lần retry, chuyển FAILED_PERMANENT.", outboxId);
            }
        } else {
            // Nhóm Batch công nợ: Chuyển RETRY_PENDING, hẹn đúng 14:00 chiều nay (hoặc ngày mai)
            LocalDate today = LocalDate.now(VIETNAM_ZONE);
            LocalDateTime target14 = today.atTime(14, 0, 0);
            if (LocalDateTime.now().isAfter(target14)) {
                target14 = target14.plusDays(1);
            }

            emailOutboxRepository.updateRetryIfProcessing(
                    outboxId,
                    OutboxStatus.RETRY_PENDING,
                    nextRetryCount,
                    target14,
                    errorMsg,
                    LocalDateTime.now()
            );
            log.info("Lên lịch retry cho batch email outboxId {} vào mốc 14:00 ({})", outboxId, target14);
        }
    }

    /**
     * Lịch 14:00 Chiều: Gửi lại toàn bộ mail công nợ lỗi trong ngày (duy nhất 1 lần).
     */
    @Scheduled(cron = "0 0 14 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void retryPendingBatchEmails() {
        log.info("Bắt đầu tiến trình 14:00 retry các email công nợ/tổng hợp bị lỗi...");
        stuckJobRecoveryService.recoverStuckJobs();

        List<EmailType> batchTypes = List.of(
                EmailType.INVOICE_DIGEST,
                EmailType.STATEMENT,
                EmailType.DEBT_REMINDER
        );

        List<EmailOutbox> pendingList = emailOutboxRepository.findRetryPendingByTypeIn(
                OutboxStatus.RETRY_PENDING,
                batchTypes,
                LocalDateTime.now()
        );

        log.info("Tìm thấy {} email công nợ cần retry lúc 14:00", pendingList.size());

        for (EmailOutbox item : pendingList) {
            UUID id = item.getId();
            int locked = emailOutboxRepository.markProcessingIfPendingOrRetry(id, LocalDateTime.now());
            if (locked == 0) continue;

            if (shouldSkipOutbox(item)) continue;

            emailOutboxService.markHttpInitiated(id);
            List<String> tags = List.of("outbox-" + id.toString());

            try {
                String messageId = emailService.sendBrevoEmailRaw(
                        item.getRecipientEmail(),
                        item.getRecipientName(),
                        item.getSubject(),
                        item.getHtmlContent(),
                        tags
                );

                emailOutboxRepository.updateStatusIfProcessing(
                        id,
                        OutboxStatus.SENT,
                        messageId,
                        null,
                        LocalDateTime.now(),
                        LocalDateTime.now()
                );
                log.info("14:00 Retry thành công cho outboxId={}", id);

            } catch (BrevoApiException e) {
                emailOutboxRepository.updateStatusIfProcessing(
                        id,
                        OutboxStatus.FAILED_PERMANENT,
                        null,
                        "14:00 Retry thất bại (HTTP " + e.getStatusCode() + "): " + e.getResponseBody(),
                        LocalDateTime.now(),
                        LocalDateTime.now()
                );
            } catch (Exception e) {
                if (isReadTimeout(e)) {
                    emailOutboxRepository.updateStatusIfProcessing(
                            id,
                            OutboxStatus.UNKNOWN,
                            null,
                            "14:00 Retry Socket Read Timeout: " + e.getMessage(),
                            null,
                            LocalDateTime.now()
                    );
                } else {
                    emailOutboxRepository.updateStatusIfProcessing(
                            id,
                            OutboxStatus.FAILED_PERMANENT,
                            null,
                            "14:00 Retry thất bại: " + e.getMessage(),
                            LocalDateTime.now(),
                            LocalDateTime.now()
                    );
                }
            }
        }
        log.info("Hoàn tất tiến trình 14:00 retry.");
    }

    private boolean isRealTimeEmail(EmailType type) {
        return type == EmailType.PASSWORD_RESET
                || type == EmailType.EMAIL_VERIFICATION
                || type == EmailType.PASSWORD_CHANGED
                || type == EmailType.PAYMENT_CONFIRMED
                || type == EmailType.PAYMENT_APPROVED
                || type == EmailType.PAYMENT_REJECTED;
    }

    private boolean isReadTimeout(Throwable e) {
        Throwable current = e;
        while (current != null) {
            if (current instanceof HttpConnectTimeoutException) {
                return false;
            }
            if (current instanceof HttpTimeoutException) {
                return true;
            }
            if (current instanceof SocketTimeoutException) {
                String msg = current.getMessage();
                return msg == null || !msg.toLowerCase().contains("connect");
            }
            current = current.getCause();
        }
        return false;
    }

    private List<UUID> parsePaymentRequestIds(String json) {
        List<UUID> list = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root.has("paymentRequestIds") && root.get("paymentRequestIds").isArray()) {
                for (JsonNode item : root.get("paymentRequestIds")) {
                    list.add(UUID.fromString(item.asText()));
                }
            }
        } catch (Exception e) {
            log.debug("Lỗi parse paymentRequestIds từ JSON {}: {}", json, e.getMessage());
        }
        return list;
    }
}
