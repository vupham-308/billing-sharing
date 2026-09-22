package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
@Slf4j
@RequiredArgsConstructor
public class NewInvoiceNotificationService {

    private final NewInvoiceDigestReader reader;
    private final EmailOutboxService emailOutboxService;
    private final EmailOutboxRepository emailOutboxRepository;
    private final EmailService emailService;
    private final Clock businessClock;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Scheduled(cron = "0 0 8 * * ?", zone = "Asia/Ho_Chi_Minh")
    public void sendYesterdayInvoices() {
        LocalDate yesterday = LocalDate.now(businessClock).minusDays(1);
        log.info("Bắt đầu tiến trình 08:00 sáng tổng hợp hóa đơn mới ngày hôm qua: {}", yesterday);

        for (var digest : reader.read(yesterday)) {
            try {
                send(digest);
            } catch (Exception e) {
                log.error("Lỗi khi ghi nhận thông báo hóa đơn mới cho user {} ngày {}: {}", digest.userId(), yesterday, e.getMessage());
            }
        }
    }

    private void send(NewInvoiceDigestReader.Digest digest) {
        String businessKey = "INVOICE_DIGEST:" + digest.userId() + ":" + digest.date();

        if (emailOutboxRepository.existsByBusinessKey(businessKey)) {
            log.debug("User {} đã có email digest cho ngày {}, bỏ qua.", digest.userId(), digest.date());
            return;
        }

        String dateStr = digest.date().format(DATE_FORMATTER);
        String subject = "Tổng hợp hóa đơn mới ngày " + dateStr + " - Billing Sharing";
        String htmlContent = emailService.buildInvoiceDigestHtml(
                digest.name(),
                dateStr,
                digest.invoiceCount(),
                digest.totalDebt(),
                digest.totalCredit()
        );

        emailOutboxService.recordOutbox(
                EmailType.INVOICE_DIGEST,
                digest.email(),
                digest.name(),
                subject,
                htmlContent,
                null,
                businessKey,
                digest.date()
        );
    }
}
