package com.kai.billingsharing.controller;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import com.kai.billingsharing.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BrevoWebhookControllerTest {

    @Mock
    private EmailOutboxRepository emailOutboxRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private BrevoWebhookController webhookController;

    @Test
    void testBrevoWebhook_DeliveredEvent_TransitionsUnknownToDelivered() {
        UUID outboxId = UUID.randomUUID();
        EmailOutbox outbox = EmailOutbox.builder()
                .id(outboxId)
                .status(OutboxStatus.UNKNOWN) // Was unknown due to timeout
                .recipientEmail("user@example.com")
                .build();

        when(emailOutboxRepository.findById(outboxId)).thenReturn(Optional.of(outbox));

        String payload = """
                {
                    "event": "delivered",
                    "email": "user@example.com",
                    "message-id": "<msg-123@brevo.com>",
                    "tags": ["outbox-%s"]
                }
                """.formatted(outboxId);

        ResponseEntity<Map<String, String>> response = webhookController.handleBrevoWebhook(null, null, null, payload);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("DELIVERED", outbox.getDeliveryStatus());
        assertEquals(OutboxStatus.SENT, outbox.getStatus()); // UNKNOWN cleared to SENT!
        verify(emailOutboxRepository).save(outbox);
    }

    @Test
    void testBrevoWebhook_HardBounceEvent_MarksUserEmailBounced() {
        UUID outboxId = UUID.randomUUID();
        String recipientEmail = "invalid@example.com";
        EmailOutbox outbox = EmailOutbox.builder()
                .id(outboxId)
                .status(OutboxStatus.SENT)
                .recipientEmail(recipientEmail)
                .build();

        User user = User.builder()
                .id(UUID.randomUUID())
                .email(recipientEmail)
                .isEmailBounced(false)
                .build();

        when(emailOutboxRepository.findById(outboxId)).thenReturn(Optional.of(outbox));
        when(userRepository.findByEmail(recipientEmail)).thenReturn(Optional.of(user));

        String payload = """
                {
                    "event": "hard_bounce",
                    "email": "%s",
                    "tags": ["outbox-%s"]
                }
                """.formatted(recipientEmail, outboxId);

        webhookController.handleBrevoWebhook(null, null, null, payload);

        assertEquals("BOUNCED", outbox.getDeliveryStatus());
        assertTrue(user.getIsEmailBounced(), "User.isEmailBounced must be set to true on hard bounce");
        verify(userRepository).save(user);
    }

    @Test
    void testBrevoWebhook_SecretValidation_RejectsInvalidSecret() {
        org.springframework.test.util.ReflectionTestUtils.setField(webhookController, "configuredSecret", "mySecret123");

        com.kai.billingsharing.exception.AppException ex = assertThrows(
                com.kai.billingsharing.exception.AppException.class,
                () -> webhookController.handleBrevoWebhook("wrongSecret", null, null, "{}")
        );
        assertEquals(401, ex.getStatus().value());
    }

    @Test
    void testBrevoWebhook_SecretInQueryParam_AcceptsValidSecret() {
        org.springframework.test.util.ReflectionTestUtils.setField(webhookController, "configuredSecret", "mySecret123");

        ResponseEntity<Map<String, String>> response = webhookController.handleBrevoWebhook(null, "mySecret123", null, "{}");
        assertEquals(200, response.getStatusCode().value());
    }
}
