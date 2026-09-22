package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledTaskService {

    private final GroupRepository groupRepository;
    private final TransactionSharingMemberRepository sharingMemberRepository;
    private final PaymentRequestRepository paymentRequestRepository;
    private final PaymentInfoRepository paymentInfoRepository;
    private final EmailService emailService;
    private final TokenRepository tokenRepository;

    /**
     * Chạy vào 8:00 AM hàng ngày:
     * Kiểm tra các nhóm có ngày tổng hợp (summaryDayOfMonth) là ngày hôm nay.
     * Tự động tổng hợp sao kê, tạo PaymentRequest ở trạng thái PENDING và gửi email tới thành viên.
     */
    @Scheduled(cron = "0 0 8 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void processMonthlyGroupSummary() {
        int today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).getDayOfMonth();
        log.info("Bắt đầu tiến trình tổng hợp sao kê hàng tháng cho ngày: {}", today);

        List<Group> groups = groupRepository.findBySummaryDayOfMonth(today);
        for (Group group : groups) {
            try {
                processSummaryForGroup(group);
            } catch (Exception e) {
                log.error("Lỗi khi tổng hợp sao kê cho nhóm {}: {}", group.getName(), e.getMessage());
            }
        }
    }

    @Transactional
    public void processSummaryForGroup(Group group) {
        List<TransactionSharingMember> unpaidShares = sharingMemberRepository
                .findByTransactionGroupIdAndIsPaidFalse(group.getId());

        if (unpaidShares.isEmpty()) {
            log.info("Nhóm {} không có khoản nợ chưa thanh toán trong kỳ này.", group.getName());
            return;
        }

        // Gom các khoản nợ theo từng Debtor (người nợ)
        Map<User, List<TransactionSharingMember>> debtorSharesMap = new HashMap<>();
        for (TransactionSharingMember share : unpaidShares) {
            debtorSharesMap.computeIfAbsent(share.getUser(), k -> new ArrayList<>()).add(share);

            // Tạo PaymentRequest ở trạng thái PENDING nếu chưa có
            if (!paymentRequestRepository.existsBySharingMemberId(share.getId())) {
                User creditor = share.getTransaction().getPayer();
                String note = "Thanh toan " + share.getTransaction().getTitle() + " - Nhom " + group.getName();

                PaymentRequest pr = PaymentRequest.builder()
                        .transaction(share.getTransaction())
                        .sharingMember(share)
                        .debtor(share.getUser())
                        .creditor(creditor)
                        .amount(share.getShareAmount())
                        .status(PaymentRequestStatus.PENDING)
                        .note(note)
                        .build();

                paymentRequestRepository.save(pr);
            }
        }

        // Gửi email sao kê tổng hợp kèm danh sách hóa đơn và mã QR
        for (Map.Entry<User, List<TransactionSharingMember>> entry : debtorSharesMap.entrySet()) {
            User debtor = entry.getKey();
            List<TransactionSharingMember> shares = entry.getValue();

            long totalDebt = shares.stream().mapToLong(TransactionSharingMember::getShareAmount).sum();
            List<String> details = new ArrayList<>();
            String qrUrl = null;

            for (TransactionSharingMember s : shares) {
                String line = s.getTransaction().getTitle() + ": " + String.format("%,d", s.getShareAmount()) + " VND (Người nhận: " + s.getTransaction().getPayer().getFullName() + ")";
                details.add(line);

                // Lấy QR của chủ nợ đầu tiên
                if (qrUrl == null) {
                    User creditor = s.getTransaction().getPayer();
                    qrUrl = paymentInfoRepository.findByUserId(creditor.getId())
                            .map(info -> info.buildQrUrl(s.getShareAmount(), "Thanh toan " + s.getTransaction().getTitle()))
                            .orElse(null);
                }
            }

            emailService.sendMonthlyStatementEmail(
                    debtor.getEmail(),
                    debtor.getFullName(),
                    group.getName(),
                    totalDebt,
                    details,
                    qrUrl
            );
        }
    }

    /**
     * Chạy vào 9:00 AM hàng ngày:
     * Quét tất cả các PaymentRequest đang ở trạng thái PENDING và gửi email nhắc nhở thanh toán.
     */
    @Scheduled(cron = "0 0 9 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional(readOnly = true)
    public void sendDailyPendingReminders() {
        log.info("Bắt đầu tiến trình 9h sáng nhắc nhở các yêu cầu thanh toán PENDING...");

        List<PaymentRequest> pendingRequests = paymentRequestRepository.findByStatus(PaymentRequestStatus.PENDING);
        log.info("Tìm thấy {} yêu cầu thanh toán đang PENDING.", pendingRequests.size());

        for (PaymentRequest pr : pendingRequests) {
            try {
                User debtor = pr.getDebtor();
                User creditor = pr.getCreditor();

                String qrUrl = paymentInfoRepository.findByUserId(creditor.getId())
                        .map(info -> info.buildQrUrl(pr.getAmount(), pr.getNote()))
                        .orElse(null);

                emailService.sendPaymentReminderEmail(
                        debtor.getEmail(),
                        debtor.getFullName(),
                        creditor.getFullName(),
                        pr.getAmount(),
                        pr.getNote(),
                        qrUrl
                );
            } catch (Exception e) {
                log.error("Lỗi khi gửi email nhắc nhở cho request {}: {}", pr.getId(), e.getMessage());
            }
        }
    }

    /**
     * Chạy vào 4:00 AM ngày 5 hàng tháng:
     * Dọn dẹp tất cả các password reset token đã hết hạn hoặc đã sử dụng để tối ưu cơ sở dữ liệu.
     */
    @Scheduled(cron = "0 0 4 5 * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void cleanupExpiredAndUsedPasswordResetTokens() {
        log.info("Bắt đầu tiến trình 4:00 AM ngày 5 hàng tháng dọn dẹp các token đã hết hạn hoặc đã sử dụng...");
        try {
            LocalDateTime now = LocalDateTime.now();
            int deletedCount = tokenRepository.deleteExpiredOrUsedTokens(now);
            log.info("Đã xóa {} token đã hết hạn hoặc đã sử dụng thành công.", deletedCount);
        } catch (Exception e) {
            log.error("Lỗi khi dọn dẹp token: {}", e.getMessage(), e);
        }
    }
}
