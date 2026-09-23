package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class NewInvoiceNotificationServiceTest {
    private final NewInvoiceDigestReader reader = mock(NewInvoiceDigestReader.class);
    private final EmailOutboxService emailOutboxService = mock(EmailOutboxService.class);
    private final EmailOutboxRepository emailOutboxRepository = mock(EmailOutboxRepository.class);
    private final EmailService emailService = mock(EmailService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-22T01:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final NewInvoiceNotificationService service = new NewInvoiceNotificationService(
            reader, emailOutboxService, emailOutboxRepository, emailService, clock
    );
    private final LocalDate date = LocalDate.of(2026, 9, 21);

    @Test
    void usesVietnamCalendarEvenWhenUtcDateDiffers() {
        Clock midnight = Clock.fixed(Instant.parse("2026-09-21T17:01:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        when(reader.read(date)).thenReturn(List.of());
        new NewInvoiceNotificationService(reader, emailOutboxService, emailOutboxRepository, emailService, midnight).sendYesterdayInvoices();
        verify(reader).read(date);
        verifyNoInteractions(emailOutboxService);
    }

    @Test
    void recordsOutboxWhenNotExists() {
        var digest = digest();
        when(reader.read(date)).thenReturn(List.of(digest));
        when(emailOutboxRepository.existsByBusinessKey(anyString())).thenReturn(false);
        when(emailService.buildInvoiceDigestHtml(anyString(), anyString(), anyInt(), anyLong(), anyLong(), any()))
                .thenReturn("<p>HTML</p>");

        service.sendYesterdayInvoices();

        verify(emailOutboxService).recordOutbox(
                eq(EmailType.INVOICE_DIGEST),
                eq(digest.email()),
                eq(digest.name()),
                contains("Tổng hợp hóa đơn mới"),
                eq("<p>HTML</p>"),
                isNull(),
                eq("INVOICE_DIGEST:" + digest.userId() + ":" + date),
                eq(date)
        );
    }

    @Test
    void alreadyClaimedDayIsNotRecordedAgain() {
        var digest = digest();
        when(reader.read(date)).thenReturn(List.of(digest));
        when(emailOutboxRepository.existsByBusinessKey("INVOICE_DIGEST:" + digest.userId() + ":" + date)).thenReturn(true);

        service.sendYesterdayInvoices();

        verifyNoInteractions(emailOutboxService);
    }

    private NewInvoiceDigestReader.Digest digest() {
        return new NewInvoiceDigestReader.Digest(UUID.randomUUID(), "test@example.com", "An", date, 2, 100L, 200L);
    }
}
