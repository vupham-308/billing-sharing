package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StuckJobRecoveryService {

    private final EmailOutboxRepository emailOutboxRepository;

    /**
     * Kích hoạt tự động khi server khởi động xong (ApplicationReadyEvent).
     * Tuyệt đối không cần polling mỗi 2 phút.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        log.info("Ứng dụng khởi động hoàn tất. Bắt đầu kiểm tra và phục hồi các email outbox bị kẹt trạng thái PROCESSING...");
        recoverStuckJobs();
    }

    /**
     * Phục hồi các job bị kẹt PROCESSING quá 5 phút (do crash, downtime, restart).
     * Cũng được gọi kết hợp trong cron 14:00.
     */
    @Transactional
    public void recoverStuckJobs() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(5);
        List<EmailOutbox> stuckList = emailOutboxRepository.findStuckProcessing(threshold);

        if (stuckList.isEmpty()) {
            log.info("Không có email nào bị kẹt PROCESSING.");
            return;
        }

        log.warn("Tìm thấy {} email outbox bị kẹt PROCESSING quá 5 phút. Tiến hành phục hồi an toàn...", stuckList.size());

        for (EmailOutbox job : stuckList) {
            if (Boolean.TRUE.equals(job.getHttpCallInitiated())) {
                // Request mạng đã rời máy chủ, không rõ Brevo đã gửi hay chưa -> Bắt buộc gán UNKNOWN chờ Webhook
                job.setStatus(OutboxStatus.UNKNOWN);
                job.setLastError("Server bị gián đoạn khi HTTP request đã gửi tới Brevo. Chuyển sang UNKNOWN chờ Webhook đối soát, tránh gửi trùng.");
                log.warn("Job id={} có httpCallInitiated=true -> Chuyển UNKNOWN", job.getId());
            } else {
                // Request chưa từng rời máy chủ -> An toàn chuyển về RETRY_PENDING
                job.setStatus(OutboxStatus.RETRY_PENDING);
                job.setLastError("Server bị gián đoạn trước khi mở kết nối mạng. Chuyển về RETRY_PENDING.");
                log.info("Job id={} có httpCallInitiated=false -> Chuyển RETRY_PENDING", job.getId());
            }
            emailOutboxRepository.save(job);
        }
        log.info("Đã phục hồi xong {} email outbox bị kẹt.", stuckList.size());
    }
}
