package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.InvoiceDigestDelivery;
import com.kai.billingsharing.repository.InvoiceDigestDeliveryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class NewInvoiceNotificationServiceTest {
    private final NewInvoiceDigestReader reader = mock(NewInvoiceDigestReader.class);
    private final InvoiceDigestDeliveryRepository deliveries = mock(InvoiceDigestDeliveryRepository.class);
    private final EmailService email = mock(EmailService.class);
    // 08:00 Sep 22 in Vietnam, Sep 22 UTC; below test also checks the UTC date boundary.
    private final Clock clock = Clock.fixed(Instant.parse("2026-09-22T01:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final NewInvoiceNotificationService service = new NewInvoiceNotificationService(reader, deliveries, email, clock);
    private final LocalDate date = LocalDate.of(2026, 9, 21);

    @Test
    void usesVietnamCalendarEvenWhenUtcDateDiffers() {
        Clock midnight = Clock.fixed(Instant.parse("2026-09-21T17:01:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        when(reader.read(date)).thenReturn(List.of());
        new NewInvoiceNotificationService(reader, deliveries, email, midnight).sendYesterdayInvoices();
        verify(reader).read(date);
        verifyNoInteractions(email, deliveries);
    }

    @Test
    void recordsClaimBeforeSendingAndAcceptanceAfterward() {
        var digest = digest();
        when(reader.read(date)).thenReturn(List.of(digest));
        service.sendYesterdayInvoices();
        var order = inOrder(deliveries, email);
        order.verify(deliveries).existsByUserIdAndInvoiceDate(digest.userId(), date);
        order.verify(deliveries).saveAndFlush(any());
        order.verify(email).sendNewInvoiceDigest(digest);
        order.verify(deliveries).saveAndFlush(argThat(d -> d.getStatus() == InvoiceDigestDelivery.Status.ACCEPTED));
    }

    @Test
    void alreadyClaimedDayIsNotSentAgain() {
        var digest = digest();
        when(reader.read(date)).thenReturn(List.of(digest));
        when(deliveries.existsByUserIdAndInvoiceDate(digest.userId(), date)).thenReturn(true);
        service.sendYesterdayInvoices();
        verifyNoInteractions(email);
        verify(deliveries, never()).saveAndFlush(any());
    }

    @Test
    void concurrentClaimWinnerPreventsAnotherSend() {
        var digest = digest();
        when(reader.read(date)).thenReturn(List.of(digest));
        when(deliveries.existsByUserIdAndInvoiceDate(digest.userId(), date)).thenReturn(false, true);
        when(deliveries.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate"));
        service.sendYesterdayInvoices();
        verifyNoInteractions(email);
    }

    @Test
    void failedSendIsUnknownAndDoesNotPreventOtherRecipients() {
        var first = digest();
        var second = digest();
        when(reader.read(date)).thenReturn(List.of(first, second));
        doThrow(new IllegalStateException("timeout")).when(email).sendNewInvoiceDigest(first);
        service.sendYesterdayInvoices();
        verify(email).sendNewInvoiceDigest(second);
        verify(deliveries, atLeastOnce()).saveAndFlush(argThat(d -> d.getUserId().equals(first.userId())
                && d.getStatus() == InvoiceDigestDelivery.Status.UNKNOWN));
        verify(deliveries, atLeastOnce()).saveAndFlush(argThat(d -> d.getUserId().equals(second.userId())
                && d.getStatus() == InvoiceDigestDelivery.Status.ACCEPTED));
    }

    private NewInvoiceDigestReader.Digest digest() {
        return new NewInvoiceDigestReader.Digest(UUID.randomUUID(), "test@example.com", "An", date, 2, 100L, 200L);
    }
}
