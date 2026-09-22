package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.InvoiceDigestDelivery;
import com.kai.billingsharing.repository.InvoiceDigestDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
@Slf4j
@RequiredArgsConstructor
public class NewInvoiceNotificationService {
    private final NewInvoiceDigestReader reader;
    private final InvoiceDigestDeliveryRepository deliveries;
    private final EmailService emailService;
    private final Clock businessClock;

    @Scheduled(cron = "0 0 8 * * ?", zone = "Asia/Ho_Chi_Minh")
    public void sendYesterdayInvoices() {
        LocalDate yesterday = LocalDate.now(businessClock).minusDays(1);
        // Reader transaction ends before calling the external email provider.
        for (var digest : reader.read(yesterday)) {
            try {
                send(digest);
            } catch (Exception e) {
                log.error("New invoice notification failed for user {} on {}", digest.userId(), yesterday, e);
            }
        }
    }

    private void send(NewInvoiceDigestReader.Digest digest) {
        if (deliveries.existsByUserIdAndInvoiceDate(digest.userId(), digest.date())) return;
        var delivery = new InvoiceDigestDelivery();
        delivery.setUserId(digest.userId());
        delivery.setInvoiceDate(digest.date());
        delivery.setUpdatedAt(LocalDateTime.now(businessClock));
        try {
            // This repository transaction commits the unique claim before sending.
            deliveries.saveAndFlush(delivery);
        } catch (DataIntegrityViolationException e) {
            if (deliveries.existsByUserIdAndInvoiceDate(digest.userId(), digest.date())) return;
            throw e;
        }
        try {
            emailService.sendNewInvoiceDigest(digest);
            delivery.setStatus(InvoiceDigestDelivery.Status.ACCEPTED);
        } catch (Exception e) {
            // A lost HTTP response may mean the provider already accepted the email.
            // Never automatically resend an ambiguous attempt.
            delivery.setStatus(InvoiceDigestDelivery.Status.UNKNOWN);
            throw e;
        } finally {
            delivery.setUpdatedAt(LocalDateTime.now(businessClock));
            deliveries.saveAndFlush(delivery);
        }
    }
}
