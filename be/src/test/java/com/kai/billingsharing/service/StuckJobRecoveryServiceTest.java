package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StuckJobRecoveryServiceTest {

    @Mock
    private EmailOutboxRepository emailOutboxRepository;

    @InjectMocks
    private StuckJobRecoveryService stuckJobRecoveryService;

    @Test
    void testStuckJobRecovery_HttpCallInitiatedTrue_TransitionsToUnknown() {
        EmailOutbox job = EmailOutbox.builder()
                .id(UUID.randomUUID())
                .status(OutboxStatus.PROCESSING)
                .httpCallInitiated(true) // Packet left machine before server crash
                .build();

        when(emailOutboxRepository.findStuckProcessing(any())).thenReturn(List.of(job));

        stuckJobRecoveryService.recoverStuckJobs();

        assertEquals(OutboxStatus.UNKNOWN, job.getStatus());
        assertTrue(job.getLastError().contains("UNKNOWN"));
        verify(emailOutboxRepository).save(job);
    }

    @Test
    void testStuckJobRecovery_HttpCallInitiatedFalse_TransitionsToRetryPending() {
        EmailOutbox job = EmailOutbox.builder()
                .id(UUID.randomUUID())
                .status(OutboxStatus.PROCESSING)
                .httpCallInitiated(false) // Never left machine before server crash
                .build();

        when(emailOutboxRepository.findStuckProcessing(any())).thenReturn(List.of(job));

        stuckJobRecoveryService.recoverStuckJobs();

        assertEquals(OutboxStatus.RETRY_PENDING, job.getStatus());
        assertTrue(job.getLastError().contains("RETRY_PENDING"));
        verify(emailOutboxRepository).save(job);
    }
}
