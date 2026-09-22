package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.PaymentRequest;
import com.kai.billingsharing.entity.Token;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import com.kai.billingsharing.repository.PaymentRequestRepository;
import com.kai.billingsharing.repository.TokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;

import java.net.http.HttpTimeoutException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailOutboxWorkerTest {

    @Mock
    private EmailOutboxRepository emailOutboxRepository;

    @Mock
    private EmailOutboxService emailOutboxService;

    @Mock
    private EmailService emailService;

    @Mock
    private PaymentRequestRepository paymentRequestRepository;

    @Mock
    private TokenRepository tokenRepository;

    @Mock
    private StuckJobRecoveryService stuckJobRecoveryService;

    @Mock
    private TaskScheduler taskScheduler;

    @InjectMocks
    private EmailOutboxWorker worker;

    @Test
    void testOutboxWorker_DebtReminder_WhenDebtsCompletedBeforeSending_MarksSkipped() {
        UUID outboxId = UUID.randomUUID();
        UUID reqId = UUID.randomUUID();

        EmailOutbox outbox = EmailOutbox.builder()
                .id(outboxId)
                .type(EmailType.DEBT_REMINDER)
                .recipientEmail("debtor@example.com")
                .subject("Nhắc nợ")
                .htmlContent("<p>Nợ</p>")
                .payloadJson("{\"paymentRequestIds\":[\"" + reqId + "\"]}")
                .businessKey("DEBT_REMINDER:123:2026-09-22")
                .businessDate(LocalDate.now())
                .status(OutboxStatus.PROCESSING)
                .build();

        PaymentRequest pr = PaymentRequest.builder()
                .id(reqId)
                .status(PaymentRequestStatus.COMPLETED) // Already paid!
                .build();

        when(emailOutboxRepository.markProcessingIfPendingOrRetry(eq(outboxId), any())).thenReturn(1);
        when(emailOutboxRepository.findById(outboxId)).thenReturn(Optional.of(outbox));
        when(paymentRequestRepository.findAllById(List.of(reqId))).thenReturn(List.of(pr));

        worker.processOutboxAsync(outboxId);

        // Verify it was marked SKIPPED and NO email was sent
        verify(emailOutboxRepository).updateStatusIfProcessing(
                eq(outboxId),
                eq(OutboxStatus.SKIPPED),
                isNull(),
                contains("đã được thanh toán"),
                any(),
                any()
        );
        verifyNoInteractions(emailService);
    }

    @Test
    void testOutboxWorker_EmailVerification_TokenExpiredOrUsed_MarksSkipped() {
        UUID outboxId = UUID.randomUUID();
        UUID tokenId = UUID.randomUUID();

        EmailOutbox outbox = EmailOutbox.builder()
                .id(outboxId)
                .type(EmailType.EMAIL_VERIFICATION)
                .recipientEmail("user@example.com")
                .subject("Xác thực")
                .htmlContent("<p>Xác thực</p>")
                .payloadJson("{\"tokenId\":\"" + tokenId + "\"}")
                .businessKey("EMAIL_VERIFICATION:123:" + tokenId)
                .businessDate(LocalDate.now())
                .status(OutboxStatus.PROCESSING)
                .build();

        Token token = Token.builder()
                .id(tokenId)
                .used(true) // Token already used!
                .expiryDate(LocalDateTime.now().plusHours(1))
                .user(User.builder().isActive(false).build())
                .build();

        when(emailOutboxRepository.markProcessingIfPendingOrRetry(eq(outboxId), any())).thenReturn(1);
        when(emailOutboxRepository.findById(outboxId)).thenReturn(Optional.of(outbox));
        when(tokenRepository.findById(tokenId)).thenReturn(Optional.of(token));

        worker.processOutboxAsync(outboxId);

        verify(emailOutboxRepository).updateStatusIfProcessing(
                eq(outboxId),
                eq(OutboxStatus.SKIPPED),
                isNull(),
                contains("đã hết hạn hoặc đã được sử dụng"),
                any(),
                any()
        );
        verifyNoInteractions(emailService);
    }

    @Test
    void testOutboxWorker_ReadTimeout_TransitionsToUnknown() throws Exception {
        UUID outboxId = UUID.randomUUID();

        EmailOutbox outbox = EmailOutbox.builder()
                .id(outboxId)
                .type(EmailType.PASSWORD_RESET)
                .recipientEmail("user@example.com")
                .subject("Đặt lại mật khẩu")
                .htmlContent("<p>Reset</p>")
                .businessKey("PASSWORD_RESET:123:abc")
                .businessDate(LocalDate.now())
                .status(OutboxStatus.PROCESSING)
                .retryCount(0)
                .maxRetries(3)
                .build();

        when(emailOutboxRepository.markProcessingIfPendingOrRetry(eq(outboxId), any())).thenReturn(1);
        when(emailOutboxRepository.findById(outboxId)).thenReturn(Optional.of(outbox));
        when(emailService.sendBrevoEmailRaw(anyString(), any(), anyString(), anyString(), anyList()))
                .thenThrow(new HttpTimeoutException("request timed out"));

        worker.processOutboxAsync(outboxId);

        // When socket read timeout happens, it must transition to UNKNOWN, NOT FAILED_PERMANENT!
        verify(emailOutboxRepository).updateStatusIfProcessing(
                eq(outboxId),
                eq(OutboxStatus.UNKNOWN),
                isNull(),
                contains("Socket Read Timeout"),
                isNull(),
                any()
        );
    }
}
