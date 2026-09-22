package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.dto.response.ManualSettlementResponse;
import com.kai.billingsharing.dto.response.PaymentRequestBreakdownResponse;
import com.kai.billingsharing.dto.response.PaymentRequestItemResponse;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.security.CustomUserDetails;
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
import java.util.stream.Collectors;

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
                processSummaryForGroup(group, todayDate.atTime(8, 30));
            } catch (Exception e) {
                log.error("Lỗi khi tổng hợp sao kê cho nhóm {}: {}", group.getName(), e.getMessage(), e);
            }
        }
    }

    @Transactional
    public ManualSettlementResponse settleGroupEarly(UUID groupId, CustomUserDetails currentUser) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new AppException("Nhóm không tồn tại", org.springframework.http.HttpStatus.NOT_FOUND));
        if (group.getCreatedBy() == null || !group.getCreatedBy().getId().equals(currentUser.getId())) {
            throw new AppException("Chỉ trưởng nhóm mới có quyền tất toán trước hạn", org.springframework.http.HttpStatus.FORBIDDEN);
        }

        LocalDateTime now = LocalDateTime.now(businessClock);
        statementPeriodRepository.findTopByGroupIdOrderByEndDateDesc(groupId)
                .filter(period -> period.getEndDate() != null
                        && period.getEndDate().toLocalDate().equals(now.toLocalDate()))
                .ifPresent(period -> {
                    throw new AppException("Nhóm đã được tất toán trong ngày hôm nay", org.springframework.http.HttpStatus.CONFLICT);
                });
        return processSummaryForGroup(group, now);
    }

    @Transactional
    public ManualSettlementResponse processSummaryForGroup(Group group, LocalDateTime endDate) {
        int createdPaymentRequests = 0;
        int existingPaymentRequests = 0;
        // 1. Đồng bộ các khoản chi tiêu chưa thanh toán thành PaymentRequest PENDING (với cấn trừ nợ chéo 2 chiều)
        List<TransactionSharingMember> unpaidShares = sharingMemberRepository
                .findByTransactionGroupIdAndIsPaidFalse(group.getId());

        List<TransactionSharingMember> eligibleShares = new ArrayList<>();
        for (TransactionSharingMember share : unpaidShares) {
            if (paymentRequestRepository.existsBySharingMemberIdAndStatusIn(
                    share.getId(),
                    List.of(PaymentRequestStatus.PENDING, PaymentRequestStatus.WAITING_APPROVE)
            )) {
                existingPaymentRequests++;
            } else {
                eligibleShares.add(share);
            }
        }

        // Gom các khoản chi tiêu theo cặp 2 người (canonical pair: minId:maxId)
        Map<String, List<TransactionSharingMember>> pairMap = new LinkedHashMap<>();
        Map<UUID, User> userMap = new HashMap<>();

        for (TransactionSharingMember share : eligibleShares) {
            User creditor = share.getTransaction().getPayer();
            User debtor = share.getUser();
            if (creditor.getId().equals(debtor.getId())) continue;

            userMap.put(creditor.getId(), creditor);
            userMap.put(debtor.getId(), debtor);

            UUID u1 = debtor.getId();
            UUID u2 = creditor.getId();
            String pairKey = u1.compareTo(u2) < 0 ? (u1 + ":" + u2) : (u2 + ":" + u1);
            pairMap.computeIfAbsent(pairKey, k -> new ArrayList<>()).add(share);
        }

        for (Map.Entry<String, List<TransactionSharingMember>> entry : pairMap.entrySet()) {
            String[] userIds = entry.getKey().split(":");
            UUID id1 = UUID.fromString(userIds[0]);
            UUID id2 = UUID.fromString(userIds[1]);
            User u1 = userMap.get(id1);
            User u2 = userMap.get(id2);

            List<TransactionSharingMember> shares1To2 = new ArrayList<>(); // u1 nợ u2
            List<TransactionSharingMember> shares2To1 = new ArrayList<>(); // u2 nợ u1
            long debt1To2 = 0L;
            long debt2To1 = 0L;

            for (TransactionSharingMember sm : entry.getValue()) {
                if (sm.getUser().getId().equals(id1) && sm.getTransaction().getPayer().getId().equals(id2)) {
                    shares1To2.add(sm);
                    debt1To2 += sm.getShareAmount();
                } else if (sm.getUser().getId().equals(id2) && sm.getTransaction().getPayer().getId().equals(id1)) {
                    shares2To1.add(sm);
                    debt2To1 += sm.getShareAmount();
                }
            }

            long netDiff = debt1To2 - debt2To1;

            if (netDiff == 0L) {
                // Cấn trừ hoàn toàn: 2 người nợ nhau bằng nhau (Net = 0)
                LocalDateTime now = LocalDateTime.now();
                for (TransactionSharingMember sm : entry.getValue()) {
                    sm.setIsPaid(true);
                    sm.setPaidAt(now);
                    sharingMemberRepository.save(sm);
                }
                log.info("Cấn trừ nợ chéo hoàn toàn (0 VND) giữa {} và {} trong nhóm {}", u1.getFullName(), u2.getFullName(), group.getName());
                continue;
            }

            User debtor = netDiff > 0 ? u1 : u2;
            User creditor = netDiff > 0 ? u2 : u1;
            long netAmount = Math.abs(netDiff);
            long grossDebt = netDiff > 0 ? debt1To2 : debt2To1;
            long nettedCredit = netDiff > 0 ? debt2To1 : debt1To2;
            List<TransactionSharingMember> debtShares = netDiff > 0 ? shares1To2 : shares2To1;
            List<TransactionSharingMember> nettedShares = netDiff > 0 ? shares2To1 : shares1To2;

            List<Map<String, Object>> debtItemsJson = new ArrayList<>();
            for (TransactionSharingMember ds : debtShares) {
                debtItemsJson.add(Map.of(
                        "transactionId", ds.getTransaction().getId().toString(),
                        "transactionTitle", ds.getTransaction().getTitle(),
                        "amount", ds.getShareAmount(),
                        "isNetted", false
                ));
            }

            List<Map<String, Object>> nettedItemsJson = new ArrayList<>();
            for (TransactionSharingMember ns : nettedShares) {
                nettedItemsJson.add(Map.of(
                        "transactionId", ns.getTransaction().getId().toString(),
                        "transactionTitle", ns.getTransaction().getTitle(),
                        "amount", ns.getShareAmount(),
                        "isNetted", true
                ));
            }

            String formula = nettedCredit > 0
                    ? EmailService.money(grossDebt) + "đ (Nợ gốc) - " + EmailService.money(nettedCredit) + "đ (Cấn trừ) = " + EmailService.money(netAmount) + " VND"
                    : EmailService.money(netAmount) + " VND";

            Map<String, Object> breakdownMap = new LinkedHashMap<>();
            breakdownMap.put("grossDebt", grossDebt);
            breakdownMap.put("nettedCredit", nettedCredit);
            breakdownMap.put("netAmount", netAmount);
            breakdownMap.put("formula", formula);
            breakdownMap.put("debtorName", debtor.getFullName());
            breakdownMap.put("creditorName", creditor.getFullName());
            breakdownMap.put("debtItems", debtItemsJson);
            breakdownMap.put("nettedItems", nettedItemsJson);

            String breakdownJson = "{}";
            try {
                breakdownJson = objectMapper.writeValueAsString(breakdownMap);
            } catch (Exception e) {
                log.error("Lỗi serialize breakdownJson: {}", e.getMessage());
            }

            String identify = paymentRequestService.generateUniqueIdentify();
            String debtorBankName = paymentRequestService.resolveDebtorName(debtor);
            String note = PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(identify, debtorBankName);

            List<TransactionSharingMember> allShares = new ArrayList<>();
            allShares.addAll(debtShares);
            allShares.addAll(nettedShares);

            PaymentRequest pr = PaymentRequest.builder()
                    .group(group)
                    .debtor(debtor)
                    .creditor(creditor)
                    .amount(netAmount)
                    .originalAmount(grossDebt)
                    .nettedAmount(nettedCredit)
                    .breakdownJson(breakdownJson)
                    .status(PaymentRequestStatus.PENDING)
                    .identify(identify)
                    .note(note)
                    .sharingMembers(allShares)
                    .transaction(debtShares.isEmpty() ? (allShares.isEmpty() ? null : allShares.get(0).getTransaction()) : debtShares.get(0).getTransaction())
                    .sharingMember(debtShares.isEmpty() ? (allShares.isEmpty() ? null : allShares.get(0)) : debtShares.get(0))
                    .build();

            paymentRequestRepository.save(pr);
            createdPaymentRequests++;
        }

        // 2. Xác định mốc kỳ sao kê (StatementPeriod)
        Optional<StatementPeriod> lastPeriodOpt = statementPeriodRepository.findTopByGroupIdOrderByEndDateDesc(group.getId());
        LocalDateTime startDate = lastPeriodOpt.map(StatementPeriod::getEndDate)
                .orElse(group.getCreatedAt() != null ? group.getCreatedAt() : endDate.minusMonths(1).with(LocalTime.of(8, 30, 0)));
        int periodNumber = lastPeriodOpt.map(p -> p.getPeriodNumber() + 1).orElse(1);

        // 3. Lấy tất cả PaymentRequest còn nợ trong nhóm (PENDING và WAITING_APPROVE)
        List<PaymentRequest> activeRequests = paymentRequestRepository.findByTransactionGroupIdAndStatusIn(
                group.getId(),
                List.of(PaymentRequestStatus.PENDING, PaymentRequestStatus.WAITING_APPROVE)
        );

        if (activeRequests.isEmpty()) {
            log.info("Nhóm {} không có khoản nợ nào trong kỳ {}.", group.getName(), periodNumber);
            return ManualSettlementResponse.builder()
                    .groupId(group.getId())
                    .groupName(group.getName())
                    .paymentRequestsCreated(createdPaymentRequests)
                    .paymentRequestsExisting(existingPaymentRequests)
                    .pendingRequests(0)
                    .waitingApproveRequests(0)
                    .statementQueued(false)
                    .build();
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

            String txTitle = pr.getTransaction() != null ? pr.getTransaction().getTitle() : null;
            if (txTitle == null) {
                PaymentRequestBreakdownResponse br = paymentRequestService.parseBreakdownJson(pr.getBreakdownJson());
                if (br != null && br.getDebtItems() != null && !br.getDebtItems().isEmpty()) {
                    txTitle = br.getDebtItems().stream().map(PaymentRequestItemResponse::getTransactionTitle).collect(Collectors.joining(", "));
                } else {
                    txTitle = "Tất toán công nợ";
                }
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("requestId", pr.getId().toString());
            item.put("transactionTitle", txTitle);
            item.put("debtorId", pr.getDebtor().getId().toString());
            item.put("debtorName", pr.getDebtor().getFullName());
            item.put("creditorId", creditor.getId().toString());
            item.put("creditorName", creditor.getFullName());
            item.put("amount", pr.getAmount());
            item.put("originalAmount", pr.getOriginalAmount());
            item.put("nettedAmount", pr.getNettedAmount());
            item.put("breakdown", pr.getBreakdownJson());
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
                PaymentRequestBreakdownResponse br = paymentRequestService.parseBreakdownJson(pr.getBreakdownJson());
                String itemTitle = pr.getTransaction() != null ? pr.getTransaction().getTitle() : null;
                if (itemTitle == null && br != null && br.getDebtItems() != null && !br.getDebtItems().isEmpty()) {
                    itemTitle = br.getDebtItems().stream()
                            .map(PaymentRequestItemResponse::getTransactionTitle)
                            .collect(Collectors.joining(", "));
                }
                if (itemTitle == null) {
                    itemTitle = "Tất toán nợ nhóm " + group.getName();
                }

                if (pr.getStatus() == PaymentRequestStatus.PENDING) {
                    String qrImgHtml = "";
                    String bankInfoText = "";

                    if (paymentInfo != null) {
                        String qrUrl = paymentInfo.buildQrUrl(pr.getAmount(), cleanDesc);
                        qrImgHtml = "<div class=\"qr-container\" style=\"text-align:center;background:#f8fafc;padding:16px;margin:16px 0;\"><img src=\"" + qrUrl + "\" alt=\"Mã VietQR\" class=\"qr-img\" style=\"width:200px;max-width:100%;height:auto;display:block;margin:0 auto;\" /><div class=\"qr-desc\" style=\"font-size:12px;color:#475569;overflow-wrap:anywhere;margin-top:8px;\">STK: " + paymentInfo.getAccountNumber() + " (" + paymentInfo.getBankCode() + ") • " + paymentInfo.getAccountHolderName() + "<br/>Nội dung: <strong>" + cleanDesc + "</strong></div></div>";
                    } else {
                        bankInfoText = "<p style=\"font-size: 13px; color: #d97706; margin: 6px 0;\">Chủ nợ (" + creditor.getFullName() + ") chưa thiết lập STK ngân hàng. Vui lòng liên hệ trực tiếp.</p>";
                    }

                    StringBuilder breakdownHtml = new StringBuilder();
                    if (br != null && br.getNettedCredit() > 0) {
                        breakdownHtml.append("<div style=\"background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: #334155;\">")
                                .append("<div style=\"font-weight: 600; color: #0284c7; margin-bottom: 4px;\">✨ Đã cấn trừ nợ chéo 2 chiều:</div>")
                                .append("<div>• Tổng nợ gốc: <strong>").append(EmailService.money(br.getGrossDebt())).append(" VND</strong></div>")
                                .append("<div>• Khấu trừ nợ ngược lại: <strong style=\"color: #16a34a;\">-").append(EmailService.money(br.getNettedCredit())).append(" VND</strong></div>")
                                .append("<div style=\"margin-top: 4px; font-weight: 600;\">👉 Thực chuyển: ").append(EmailService.money(br.getNetAmount())).append(" VND</div>")
                                .append("<div style=\"font-size: 11px; color: #64748b; margin-top: 2px;\">Công thức: ").append(EmailService.escape(br.getFormula())).append("</div>")
                                .append("</div>");
                    }

                    pendingRowsHtml.append("<div class=\"item-card\" style=\"border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:16px 0;\">")
                            .append("<div class=\"item-header\" style=\"margin-bottom:12px;\">")
                            .append("<span class=\"item-title\" style=\"display:block;font-size:15px;font-weight:bold;color:#0f172a;\">").append(EmailService.escape(itemTitle)).append("</span>")
                            .append("<span class=\"item-amount\" style=\"display:block;font-size:22px;color:#be123c;font-weight:bold;margin:8px 0;\">").append(EmailService.money(pr.getAmount())).append(" VND</span>")
                            .append("</div>")
                            .append("<div class=\"item-creditor\" style=\"font-size:13px;color:#475569;margin-bottom:12px;\">Người nhận: <strong>").append(EmailService.escape(creditor.getFullName())).append("</strong></div>")
                            .append(breakdownHtml)
                            .append(bankInfoText)
                            .append(qrImgHtml)
                            .append("<div style=\"text-align: center; margin-top: 10px;\"><a href=\"").append(actionUrl).append("\" class=\"btn-action\" style=\"display:inline-block;background:#4f46e5;border:12px solid #4f46e5;border-left-width:20px;border-right-width:20px;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;text-align:center;\" target=\"_blank\">Xem yêu cầu thanh toán</a></div>")
                            .append("</div>");

                } else if (pr.getStatus() == PaymentRequestStatus.WAITING_APPROVE) {
                    hasWaiting = true;
                    waitingRowsHtml.append("<div class=\"waiting-card\" style=\"background:#fffbeb;border:1px solid #fde68a;padding:16px;margin:12px 0;border-radius:8px;\">")
                            .append("<strong>").append(EmailService.escape(itemTitle)).append("</strong>: ")
                            .append(EmailService.money(pr.getAmount())).append(" VND (Người nhận: ").append(EmailService.escape(creditor.getFullName())).append(")<br/>")
                            .append("<span style=\"font-size: 12px; color: #0284c7;\">⏳ Đang chờ chủ nợ xác nhận nhận tiền - Không cần chuyển lại</span>")
                            .append("</div>");
                }
            }

            String waitingSectionHtml = "";
            if (hasWaiting) {
                waitingSectionHtml = "<div class=\"section-title\" style=\"font-size:18px;font-weight:bold;color:#0f172a;margin:28px 0 14px;\">⏳ Các Khoản Đang Chờ Duyệt</div>"
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
                    endDate.toLocalDate()
            );
        }

        long pendingCount = activeRequests.stream().filter(r -> r.getStatus() == PaymentRequestStatus.PENDING).count();
        long waitingCount = activeRequests.stream().filter(r -> r.getStatus() == PaymentRequestStatus.WAITING_APPROVE).count();
        return ManualSettlementResponse.builder()
                .groupId(group.getId())
                .groupName(group.getName())
                .paymentRequestsCreated(createdPaymentRequests)
                .paymentRequestsExisting(existingPaymentRequests)
                .pendingRequests((int) pendingCount)
                .waitingApproveRequests((int) waitingCount)
                .statementQueued(true)
                .build();
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
                PaymentRequestBreakdownResponse br = paymentRequestService.parseBreakdownJson(pr.getBreakdownJson());
                String groupName = pr.getGroup() != null ? pr.getGroup().getName() : (pr.getTransaction() != null ? pr.getTransaction().getGroup().getName() : "Nhóm");
                String itemTitle = pr.getTransaction() != null ? pr.getTransaction().getTitle() : null;
                if (itemTitle == null && br != null && br.getDebtItems() != null && !br.getDebtItems().isEmpty()) {
                    itemTitle = br.getDebtItems().stream()
                            .map(PaymentRequestItemResponse::getTransactionTitle)
                            .collect(Collectors.joining(", "));
                }
                if (itemTitle == null) {
                    itemTitle = "Tất toán nợ nhóm " + groupName;
                }

                PaymentInfo paymentInfo = paymentInfoRepository.findByUserId(creditor.getId()).orElse(null);
                String cleanDesc = pr.getNote() != null && !pr.getNote().isBlank()
                        ? pr.getNote()
                        : PaymentDescriptionUtil.buildTransferDescriptionWithIdentify(pr.getIdentify(), paymentRequestService.resolveDebtorName(debtor));
                String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + pr.getId();

                String qrImgHtml = "";
                String bankInfoText = "";

                if (paymentInfo != null) {
                    String qrUrl = paymentInfo.buildQrUrl(pr.getAmount(), cleanDesc);
                    qrImgHtml = "<div class=\"qr-container\" style=\"text-align:center;background:#f8fafc;padding:16px;margin:16px 0;\"><img src=\"" + qrUrl + "\" alt=\"Mã VietQR\" class=\"qr-img\" style=\"width:200px;max-width:100%;height:auto;display:block;margin:0 auto;\" /><div class=\"qr-desc\" style=\"font-size:12px;color:#475569;overflow-wrap:anywhere;margin-top:8px;\">STK: " + paymentInfo.getAccountNumber() + " (" + paymentInfo.getBankCode() + ") • " + paymentInfo.getAccountHolderName() + "<br/>Nội dung: <strong>" + cleanDesc + "</strong></div></div>";
                } else {
                    bankInfoText = "<p style=\"font-size: 13px; color: #d97706; margin: 6px 0;\">Chủ nợ (" + creditor.getFullName() + ") chưa thiết lập STK ngân hàng.</p>";
                }

                StringBuilder breakdownHtml = new StringBuilder();
                if (br != null && br.getNettedCredit() > 0) {
                    breakdownHtml.append("<div style=\"background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 12px; color: #334155;\">")
                            .append("<div style=\"font-weight: 600; color: #0284c7; margin-bottom: 4px;\">✨ Đã cấn trừ nợ chéo 2 chiều:</div>")
                            .append("<div>• Tổng nợ gốc: <strong>").append(EmailService.money(br.getGrossDebt())).append(" VND</strong></div>")
                            .append("<div>• Khấu trừ nợ ngược lại: <strong style=\"color: #16a34a;\">-").append(EmailService.money(br.getNettedCredit())).append(" VND</strong></div>")
                            .append("<div style=\"margin-top: 4px; font-weight: 600;\">👉 Thực chuyển: ").append(EmailService.money(br.getNetAmount())).append(" VND</div>")
                            .append("<div style=\"font-size: 11px; color: #64748b; margin-top: 2px;\">Công thức: ").append(EmailService.escape(br.getFormula())).append("</div>")
                            .append("</div>");
                }

                debtRowsHtml.append("<div class=\"item-card\" style=\"border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:16px 0;\">")
                        .append("<div class=\"item-header\" style=\"margin-bottom:12px;\">")
                        .append("<span class=\"item-title\" style=\"display:block;font-size:15px;font-weight:bold;color:#0f172a;\">").append(EmailService.escape(itemTitle)).append(" (Nhóm: ").append(EmailService.escape(groupName)).append(")</span>")
                        .append("<span class=\"item-amount\" style=\"display:block;font-size:22px;color:#be123c;font-weight:bold;margin:8px 0;\">").append(EmailService.money(pr.getAmount())).append(" VND</span>")
                        .append("</div>")
                        .append("<div class=\"item-creditor\" style=\"font-size:13px;color:#475569;margin-bottom:12px;\">Người nhận: <strong>").append(EmailService.escape(creditor.getFullName())).append("</strong></div>")
                        .append(breakdownHtml)
                        .append(bankInfoText)
                        .append(qrImgHtml)
                        .append("<div style=\"text-align: center; margin-top: 10px;\"><a href=\"").append(actionUrl).append("\" class=\"btn-action\" style=\"display:inline-block;background:#4f46e5;border:12px solid #4f46e5;border-left-width:20px;border-right-width:20px;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;text-align:center;\" target=\"_blank\">Xem yêu cầu thanh toán</a></div>")
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
            String subject = "Nhắc nhở: Bạn có " + requests.size() + " khoản nợ cần thanh toán - Billing Sharing";

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
