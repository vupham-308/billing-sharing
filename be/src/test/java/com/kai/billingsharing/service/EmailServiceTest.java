package com.kai.billingsharing.service;

import com.kai.billingsharing.exception.AppException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.LocalDate;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class EmailServiceTest {
    @Test
    void missingApiKeyFailsInsteadOfPretendingToSend() {
        var service = new EmailService();
        ReflectionTestUtils.setField(service, "frontendUrl", "https://example.com");
        assertThrows(AppException.class, () -> service.sendNewInvoiceDigest(digest()));
    }

    @Test
    void digestEscapesNamesAndShowsBothBalancesAndPendingApprovalExplanation() {
        var service = spy(new EmailService());
        ReflectionTestUtils.setField(service, "frontendUrl", "https://example.com/billing-sharing/");
        doNothing().when(service).sendBrevoEmail(anyString(), anyString(), anyString(), anyString());
        service.sendNewInvoiceDigest(digest());
        var html = ArgumentCaptor.forClass(String.class);
        verify(service).sendBrevoEmail(eq("test@example.com"), anyString(), contains("21/09/2026"), html.capture());
        assertTrue(html.getValue().contains("&lt;img"));
        assertFalse(html.getValue().contains("<img src=x"));
        assertTrue(html.getValue().contains("100.000 VND"));
        assertTrue(html.getValue().contains("250.000 VND"));
        assertTrue(html.getValue().contains("không cần chuyển lại"));
        assertTrue(html.getValue().contains("href='https://example.com/billing-sharing'"));
    }

    private NewInvoiceDigestReader.Digest digest() {
        return new NewInvoiceDigestReader.Digest(UUID.randomUUID(), "test@example.com", "<img src=x>",
                LocalDate.of(2026, 9, 21), 2, 100000L, 250000L);
    }
}
