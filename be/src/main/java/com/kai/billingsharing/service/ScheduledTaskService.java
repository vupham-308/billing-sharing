package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.util.PaymentDescriptionUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledTaskService {

    private final GroupRepository groupRepository;
    private final TransactionSharingMemberRepository sharingMemberRepository;
    private final PaymentRequestRepository paymentRequestRepository;
    private final PaymentInfoRepository paymentInfoRepository;
    private final StatementPeriodRepository statementPeriodRepository;
    private final EmailOutboxService emailOutboxService;
    private final EmailService emailService;
    private final TokenRepository tokenRepository;
    private final PaymentRequestService paymentRequestService;
    private final Clock businessClock;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Chạy vào 08:30 AM hàng ngày (UTC+7):
     * 1. Chỉ áp dụng cho các ngày từ 1 đến 27.
     * 2. Quản lý kỳ chuẩn xác (startDate lấy endDate kỳ trước, lưu snapshotJson).
     * 3. Mỗi PaymentRequest sinh đúng 1 mã VietQR riêng biệt kèm đúng số tiền (tuyệt đối không gộp).
     * 4. Ghi nhận vào EmailOutbox với type = STATEMENT.
     */
    @Scheduled(cron = "0 30 8 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void processMonthlyGroupSummary() {
        LocalDate todayDate = LocalDate.now(businessClock);
        int today = todayDate.getDayOfMonth();

        if (today < 1 || today > 27) {
            log.info("Ngày hôm nay ({}) không nằm trong khoảng chốt sao kê 1-27 hàng tháng, bỏ qua.", today);
            return;
        }

        log.info("Bắt đầu tiến trình 08:30 sáng tổng hợp sao kê nhóm cho ngày: {}", today);
        List<Group> groups = groupRepository.findBySummaryDayOfMonth(today);

        for (Group group : groups) {
            try {
                processSummaryForGroup(group, todayDate);
            } catch (Exception e) {
                log.error("Lỗi khi tổng hợp sao kê cho nhóm {}: {}", group.getName(), e.getMessage(), e);
            }
        }
    }

    @Transactional
    public void processSummaryForGroup(Group group, LocalDate todayDate) {
        // 1. Đồng bộ các khoản chi tiêu chưa thanh toán thành PaymentRequest PENDING (nếu chưa tạo)
        List<TransactionSharingMember> unpaidShares = sharingMemberRepository
                .findByTransactionGroupIdAndIsPaidFalse(group.getId());

        for (TransactionSharingMember share : unpaidShares) {
            if (!paymentRequestRepository.existsBySharingMemberId(share.getId())) {
                User creditor = share.getTransaction().getPayer();
                User debtor = share.getUser();
                String identify = paymentRequestService.generateUniqueIdentify();
                String debtorBankName = paymentRequestService.resolveDebtorName(debtor);
                String note = PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(identify, debtorBankName);

                PaymentRequest pr = PaymentRequest.builder()
                        .transaction(share.getTransaction())
                        .sharingMember(share)
                        .debtor(debtor)
                        .creditor(creditor)
                        .amount(share.getShareAmount())
                        .status(PaymentRequestStatus.PENDING)
                        .identify(identify)
                        .note(note)
                        .build();

                paymentRequestRepository.save(pr);
            }
        }

        // 2. Xác định mốc kỳ sao kê (StatementPeriod)
        Optional<StatementPeriod> lastPeriodOpt = statementPeriodRepository.findTopByGroupIdOrderByEndDateDesc(group.getId());
        LocalDateTime startDate = lastPeriodOpt.map(StatementPeriod::getEndDate)
                .orElse(group.getCreatedAt() != null ? group.getCreatedAt() : todayDate.minusMonths(1).atTime(8, 30, 0));
        LocalDateTime endDate = todayDate.atTime(LocalTime.of(8, 30, 0));
        int periodNumber = lastPeriodOpt.map(p -> p.getPeriodNumber() + 1).orElse(1);

        // 3. Lấy tất cả PaymentRequest còn nợ trong nhóm (PENDING và WAITING_APPROVE)
        List<PaymentRequest> activeRequests = paymentRequestRepository.findByTransactionGroupIdAndStatusIn(
                group.getId(),
                List.of(PaymentRequestStatus.PENDING, PaymentRequestStatus.WAITING_APPROVE)
        );

        if (activeRequests.isEmpty()) {
            log.info("Nhóm {} không có khoản nợ nào trong kỳ {}.", group.getName(), periodNumber);
            return;
        }

        // 4. Tạo Snapshot JSON lưu trữ bất biến lịch sử kỳ sao kê
        List<Map<String, Object>> snapshotItems = new ArrayList<>();
        long totalPendingAmount = 0L;

        for (PaymentRequest pr : activeRequests) {
            if (pr.getStatus() == PaymentRequestStatus.PENDING) {
                totalPendingAmount += pr.getAmount();
            }
            User creditor = pr.getCreditor();
            PaymentInfo paymentInfo = paymentInfoRepository.findByUserId(creditor.getId()).orElse(null);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("requestId", pr.getId().toString());
            item.put("transactionTitle", pr.getTransaction().getTitle());
            item.put("debtorId", pr.getDebtor().getId().toString());
            item.put("debtorName", pr.getDebtor().getFullName());
            item.put("creditorId", creditor.getId().toString());
            item.put("creditorName", creditor.getFullName());
            item.put("amount", pr.getAmount());
            item.put("status", pr.getStatus().name());
            item.put("identify", pr.getIdentify());
            item.put("bankCode", paymentInfo != null ? paymentInfo.getBankCode() : null);
            item.put("bankName", paymentInfo != null ? paymentInfo.getBankName() : null);
            item.put("accountNumber", paymentInfo != null ? paymentInfo.getAccountNumber() : null);
            item.put("accountHolderName", paymentInfo != null ? paymentInfo.getAccountHolderName() : null);
            item.put("description", pr.getNote() != null ? pr.getNote() : PaymentDescriptionUtil.buildPaymentDescription(pr.getDebtor().getFullName()));
            snapshotItems.add(item);
        }

        String snapshotJson;
        try {
            Map<String, Object> snapshotMap = new LinkedHashMap<>();
            snapshotMap.put("groupId", group.getId().toString());
            snapshotMap.put("groupName", group.getName());
            snapshotMap.put("periodNumber", periodNumber);
            snapshotMap.put("startDate", startDate.toString());
            snapshotMap.put("endDate", endDate.toString());
            snapshotMap.put("totalPendingAmount", totalPendingAmount);
            snapshotMap.put("items", snapshotItems);
            snapshotJson = objectMapper.writeValueAsString(snapshotMap);
        } catch (Exception e) {
            log.error("Lỗi serialize snapshot sao kê nhóm {}: {}", group.getId(), e.getMessage());
            snapshotJson = "{}";
        }

        StatementPeriod period = StatementPeriod.builder()
                .group(group)
                .periodNumber(periodNumber)
                .startDate(startDate)
                .endDate(endDate)
                .snapshotJson(snapshotJson)
                .processedAt(LocalDateTime.now())
                .status("PROCESSED")
                .build();
        statementPeriodRepository.save(period);
        log.info("Đã tạo StatementPeriod kỳ {} cho nhóm {}", periodNumber, group.getName());

        // 5. Gom nợ theo từng Debtor và gửi Email Outbox
        Map<User, List<PaymentRequest>> debtorMap = new LinkedHashMap<>();
        for (PaymentRequest pr : activeRequests) {
            debtorMap.computeIfAbsent(pr.getDebtor(), k -> new ArrayList<>()).add(pr);
        }

        String periodTitle = "Kỳ " + periodNumber + " (" + startDate.format(DATE_FORMATTER) + " - " + endDate.format(DATE_FORMATTER) + ")";
        String statementWebUrl = emailService.getDashboardUrl() + "/groups/" + group.getId() + "/statements";

        for (Map.Entry<User, List<PaymentRequest>> entry : debtorMap.entrySet()) {
            User debtor = entry.getKey();
            List<PaymentRequest> requests = entry.getValue();

            long totalPendingDebt = requests.stream()
                    .filter(r -> r.getStatus() == PaymentRequestStatus.PENDING)
                    .mapToLong(PaymentRequest::getAmount)
                    .sum();

            StringBuilder pendingRowsHtml = new StringBuilder();
            StringBuilder waitingRowsHtml = new StringBuilder();
            boolean hasWaiting = false;

            for (PaymentRequest pr : requests) {
                User creditor = pr.getCreditor();
                PaymentInfo paymentInfo = paymentInfoRepository.findByUserId(creditor.getId()).orElse(null);
                String debtorBankName = paymentRequestService.resolveDebtorName(debtor);
                if (pr.getIdentify() == null || pr.getIdentify().isBlank()) {
                    String identify = paymentRequestService.generateUniqueIdentify();
                    pr.setIdentify(identify);
                    pr.setNote(PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(identify, debtorBankName));
                    pr = paymentRequestRepository.save(pr);
                } else if (pr.getStatus() == PaymentRequestStatus.PENDING) {
                    String expectedNote = PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(pr.getIdentify(), debtorBankName);
                    if (!expectedNote.equalsIgnoreCase(pr.getNote())) {
                        pr.setNote(expectedNote);
                        pr = paymentRequestRepository.save(pr);
                    }
                }
                String cleanDesc = pr.getNote();
                String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + pr.getId();

                if (pr.getStatus() == PaymentRequestStatus.PENDING) {
                    String qrImgHtml = "";
                    String bankInfoText = "";

                    if (paymentInfo != null) {
                        String qrUrl = paymentInfo.buildQrUrl(pr.getAmount(), cleanDesc);
                        qrImgHtml = "<div class=\"qr-container\"><img src=\"" + qrUrl + "\" alt=\"Mã VietQR\" class=\"qr-img\" /><div class=\"qr-desc\">STK: " + paymentInfo.getAccountNumber() + " (" + paymentInfo.getBankCode() + ") • " + paymentInfo.getAccountHolderName() + "<br/>Nội dung: <strong>" + cleanDesc + "</strong></div></div>";
                    } else {
                        bankInfoText = "<p style=\"font-size: 13px; color: #d97706; margin: 6px 0;\">Chủ nợ (" + creditor.getFullName() + ") chưa thiết lập STK ngân hàng. Vui lòng liên hệ trực tiếp.</p>";
                    }

                    pendingRowsHtml.append("<div class=\"item-card\">")
                            .append("<div class=\"item-header\">")
                            .append("<span class=\"item-title\">").append(EmailService.escape(pr.getTransaction().getTitle())).append("</span>")
                            .append("<span class=\"item-amount\">").append(EmailService.money(pr.getAmount())).append(" VND</span>")
                            .append("</div>")
                            .append("<div class=\"item-creditor\">Người nhận: <strong>").append(EmailService.escape(creditor.getFullName())).append("</strong></div>")
                            .append(bankInfoText)
                            .append(qrImgHtml)
                            .append("<div style=\"text-align: center; margin-top: 10px;\"><a href=\"").append(actionUrl).append("\" class=\"btn-action\" target=\"_blank\">Tôi đã chuyển tiền</a></div>")
                            .append("</div>");

                } else if (pr.getStatus() == PaymentRequestStatus.WAITING_APPROVE) {
                    hasWaiting = true;
                    waitingRowsHtml.append("<div class=\"waiting-card\">")
                            .append("<strong>").append(EmailService.escape(pr.getTransaction().getTitle())).append("</strong>: ")
                            .append(EmailService.money(pr.getAmount())).append(" VND (Người nhận: ").append(EmailService.escape(creditor.getFullName())).append(")<br/>")
                            .append("<span style=\"font-size: 12px; color: #0284c7;\">⏳ Đang chờ chủ nợ xác nhận nhận tiền - Không cần chuyển lại</span>")
                            .append("</div>");
                }
            }

            String waitingSectionHtml = "";
            if (hasWaiting) {
                waitingSectionHtml = "<div class=\"section-title\">⏳ Các Khoản Đang Chờ Duyệt</div>"
                        + "<p style=\"font-size: 13px; color: #64748b; margin-top: -4px;\">Các khoản này bạn đã xác nhận thanh toán. Vui lòng không chuyển lại:</p>"
                        + waitingRowsHtml.toString();
            }

            String finalPendingHtml = pendingRowsHtml.length() > 0 ? pendingRowsHtml.toString() : "<p style=\"color: #64748b;\">Bạn không có khoản nợ nào cần chuyển tiền trong kỳ này.</p>";
            String emailHtml = emailService.buildStatementHtml(
                    debtor.getFullName(),
                    group.getName(),
                    periodTitle,
                    totalPendingDebt,
                    finalPendingHtml,
                    waitingSectionHtml,
                    statementWebUrl
            );

            String businessKey = "STATEMENT:" + group.getId() + ":" + debtor.getId() + ":" + periodNumber;
            String subject = "Sao kê chi tiêu nhóm " + group.getName() + " - " + periodTitle;

            emailOutboxService.recordOutbox(
                    EmailType.STATEMENT,
                    debtor.getEmail(),
                    debtor.getFullName(),
                    subject,
                    emailHtml,
                    snapshotJson,
                    businessKey,
                    todayDate
            );
        }
    }

    /**
     * Chạy vào 09:00 AM hàng ngày:
     * 1. Gom toàn bộ khoản nợ PENDING của 1 người trên TẤT CẢ CÁC NHÓM vào duy nhất 01 email.
     * 2. Mỗi khoản nợ hiển thị đúng mã VietQR riêng, số tiền riêng, tên hóa đơn, tên nhóm.
     * 3. Lưu paymentRequestIds vào payloadJson để phục vụ Just-In-Time check khi gửi.
     */
    @Scheduled(cron = "0 0 9 * * ?", zone = "Asia/Ho_Chi_Minh")
    @Transactional(readOnly = true)
    public void sendDailyPendingReminders() {
        LocalDate todayDate = LocalDate.now(businessClock);
        log.info("Bắt đầu tiến trình 09:00 sáng nhắc nhở các yêu cầu thanh toán PENDING ngày {}...", todayDate);

        List<PaymentRequest> pendingRequests = paymentRequestRepository.findByStatus(PaymentRequestStatus.PENDING);
        if (pendingRequests.isEmpty()) {
            log.info("Không có yêu cầu thanh toán PENDING nào cần nhắc nợ.");
            return;
        }

        // Gom toàn bộ nợ theo Debtor
        Map<User, List<PaymentRequest>> debtorMap = new LinkedHashMap<>();
        for (PaymentRequest pr : pendingRequests) {
            debtorMap.computeIfAbsent(pr.getDebtor(), k -> new ArrayList<>()).add(pr);
        }

        for (Map.Entry<User, List<PaymentRequest>> entry : debtorMap.entrySet()) {
            User debtor = entry.getKey();
            List<PaymentRequest> requests = entry.getValue();

            long totalDebt = requests.stream().mapToLong(PaymentRequest::getAmount).sum();
            StringBuilder debtRowsHtml = new StringBuilder();
            List<String> requestIds = new ArrayList<>();

            for (PaymentRequest pr : requests) {
                requestIds.add(pr.getId().toString());
                User creditor = pr.getCreditor();
                String groupName = pr.getTransaction().getGroup().getName();
                PaymentInfo paymentInfo = paymentInfoRepository.findByUserId(creditor.getId()).orElse(null);
                String cleanDesc = pr.getNote() != null && !pr.getNote().isBlank()
                        ? pr.getNote()
                        : PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(pr.getIdentify(), paymentRequestService.resolveDebtorName(debtor));
                String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + pr.getId();

                String qrImgHtml = "";
                String bankInfoText = "";

                if (paymentInfo != null) {
                    String qrUrl = paymentInfo.buildQrUrl(pr.getAmount(), cleanDesc);
                    qrImgHtml = "<div class=\"qr-container\"><img src=\"" + qrUrl + "\" alt=\"Mã VietQR\" class=\"qr-img\" /><div class=\"qr-desc\">STK: " + paymentInfo.getAccountNumber() + " (" + paymentInfo.getBankCode() + ") • " + paymentInfo.getAccountHolderName() + "<br/>Nội dung: <strong>" + cleanDesc + "</strong></div></div>";
                } else {
                    bankInfoText = "<p style=\"font-size: 13px; color: #d97706; margin: 6px 0;\">Chủ nợ (" + creditor.getFullName() + ") chưa thiết lập STK ngân hàng.</p>";
                }

                debtRowsHtml.append("<div class=\"item-card\">")
                        .append("<div class=\"item-header\">")
                        .append("<span class=\"item-title\">").append(EmailService.escape(pr.getTransaction().getTitle())).append(" (Nhóm: ").append(EmailService.escape(groupName)).append(")</span>")
                        .append("<span class=\"item-amount\">").append(EmailService.money(pr.getAmount())).append(" VND</span>")
                        .append("</div>")
                        .append("<div class=\"item-creditor\">Người nhận: <strong>").append(EmailService.escape(creditor.getFullName())).append("</strong></div>")
                        .append(bankInfoText)
                        .append(qrImgHtml)
                        .append("<div style=\"text-align: center; margin-top: 10px;\"><a href=\"").append(actionUrl).append("\" class=\"btn-action\" target=\"_blank\">Tôi đã chuyển tiền</a></div>")
                        .append("</div>");
            }

            String emailHtml = emailService.buildDebtReminderHtml(
                    debtor.getFullName(),
                    totalDebt,
                    requests.size(),
                    debtRowsHtml.toString()
            );

            String payloadJson;
            try {
                payloadJson = objectMapper.writeValueAsString(Map.of("paymentRequestIds", requestIds));
            } catch (Exception e) {
                payloadJson = "{}";
            }

            String businessKey = "DEBT_REMINDER:" + debtor.getId() + ":" + todayDate;
            String subject = "Nhắc nhở: Bạn có " + requests.size() + " khoản nợ cần thanh toán - ChiaTiền";

            emailOutboxService.recordOutbox(
                    EmailType.DEBT_REMINDER,
                    debtor.getEmail(),
                    debtor.getFullName(),
                    subject,
                    emailHtml,
                    payloadJson,
                    businessKey,
                    todayDate
            );
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
