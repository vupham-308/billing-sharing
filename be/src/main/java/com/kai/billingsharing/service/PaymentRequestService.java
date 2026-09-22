package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.response.PaymentQrResponse;
import com.kai.billingsharing.dto.response.PaymentRequestResponse;
import com.kai.billingsharing.dto.response.PaymentRequestsSummaryResponse;
import com.kai.billingsharing.dto.response.UserResponse;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentRequestService {

    private final PaymentRequestRepository paymentRequestRepository;
    private final PaymentInfoRepository paymentInfoRepository;
    private final TransactionSharingMemberRepository sharingMemberRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final EmailOutboxService emailOutboxService;
    private final EmailService emailService;

    @Transactional(readOnly = true)
    public Object getMyPaymentRequests(String type, PaymentRequestStatus status, CustomUserDetails currentUser) {
        UUID currentUserId = currentUser.getId();

        List<PaymentRequest> debts;
        List<PaymentRequest> credits;

        if (status != null) {
            debts = paymentRequestRepository.findByDebtorIdAndStatusOrderByCreatedAtDesc(currentUserId, status);
            credits = paymentRequestRepository.findByCreditorIdAndStatusOrderByCreatedAtDesc(currentUserId, status);
        } else {
            debts = paymentRequestRepository.findByDebtorIdOrderByCreatedAtDesc(currentUserId);
            credits = paymentRequestRepository.findByCreditorIdOrderByCreatedAtDesc(currentUserId);
        }

        List<PaymentRequestResponse> debtResponses = debts.stream().map(this::mapToResponse).collect(Collectors.toList());
        List<PaymentRequestResponse> creditResponses = credits.stream().map(this::mapToResponse).collect(Collectors.toList());

        if ("DEBT".equalsIgnoreCase(type)) {
            return debtResponses;
        } else if ("CREDIT".equalsIgnoreCase(type)) {
            return creditResponses;
        } else {
            return PaymentRequestsSummaryResponse.builder()
                    .debts(debtResponses)
                    .credits(creditResponses)
                    .build();
        }
    }

    @Transactional(readOnly = true)
    public PaymentQrResponse getPaymentQr(UUID requestId, CustomUserDetails currentUser) {
        PaymentRequest request = paymentRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Yêu cầu thanh toán không tồn tại", HttpStatus.NOT_FOUND));

        UUID currentUserId = currentUser.getId();
        boolean isParty = request.getDebtor().getId().equals(currentUserId) || request.getCreditor().getId().equals(currentUserId);
        if (!isParty) {
            throw new AppException("Bạn không có quyền xem mã QR thanh toán của yêu cầu này", HttpStatus.FORBIDDEN);
        }

        User creditor = request.getCreditor();
        PaymentInfo paymentInfo = paymentInfoRepository.findByUserId(creditor.getId())
                .orElseThrow(() -> new AppException("Người thụ hưởng (" + creditor.getFullName() + ") chưa thiết lập tài khoản ngân hàng để tạo mã QR", HttpStatus.BAD_REQUEST));

        String qrUrl = paymentInfo.buildQrUrl(request.getAmount(), request.getNote());

        return PaymentQrResponse.builder()
                .requestId(request.getId())
                .amount(request.getAmount())
                .bankCode(paymentInfo.getBankCode())
                .accountNumber(paymentInfo.getAccountNumber())
                .accountHolderName(paymentInfo.getAccountHolderName())
                .description(request.getNote())
                .qrUrl(qrUrl)
                .build();
    }

    @Transactional
    public PaymentRequestResponse confirmPayment(UUID requestId, CustomUserDetails currentUser) {
        PaymentRequest request = paymentRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Yêu cầu thanh toán không tồn tại", HttpStatus.NOT_FOUND));

        if (!request.getDebtor().getId().equals(currentUser.getId())) {
            throw new AppException("Chỉ người cần chuyển tiền mới có quyền xác nhận đã thanh toán", HttpStatus.FORBIDDEN);
        }

        if (request.getStatus() != PaymentRequestStatus.PENDING) {
            throw new AppException("Yêu cầu này không ở trạng thái chờ thanh toán (PENDING)", HttpStatus.BAD_REQUEST);
        }

        int nextCount = (request.getConfirmationCount() == null ? 0 : request.getConfirmationCount()) + 1;
        request.setConfirmationCount(nextCount);
        request.setStatus(PaymentRequestStatus.WAITING_APPROVE);
        request.setDebtorConfirmedAt(LocalDateTime.now());
        PaymentRequest saved = paymentRequestRepository.save(request);

        // Ghi nhận EmailOutbox báo cho chủ nợ (Creditor)
        try {
            String businessKey = "PAYMENT_CONFIRMED:" + saved.getId() + ":" + nextCount;
            String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + saved.getId();
            String message = "Người nợ (" + saved.getDebtor().getFullName() + ") vừa bấm xác nhận đã chuyển khoản cho khoản nợ \"" + saved.getTransaction().getTitle() + "\". Vui lòng kiểm tra tài khoản ngân hàng và duyệt nhận tiền.";
            String html = emailService.buildPaymentNotificationHtml(
                    "Xác Nhận Đã Chuyển Tiền",
                    saved.getCreditor().getFullName(),
                    message,
                    saved.getAmount(),
                    saved.getNote(),
                    "Kiểm Tra & Duyệt Thanh Toán",
                    actionUrl
            );

            emailOutboxService.recordOutbox(
                    EmailType.PAYMENT_CONFIRMED,
                    saved.getCreditor().getEmail(),
                    saved.getCreditor().getFullName(),
                    "Xác nhận chuyển tiền: " + saved.getTransaction().getTitle(),
                    html,
                    null,
                    businessKey,
                    LocalDate.now()
            );
        } catch (Exception e) {
            log.error("Lỗi khi ghi Outbox PAYMENT_CONFIRMED cho request {}: {}", saved.getId(), e.getMessage());
        }

        return mapToResponse(saved);
    }

    @Transactional
    public PaymentRequestResponse approvePayment(UUID requestId, CustomUserDetails currentUser) {
        PaymentRequest request = paymentRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Yêu cầu thanh toán không tồn tại", HttpStatus.NOT_FOUND));

        if (!request.getCreditor().getId().equals(currentUser.getId())) {
            throw new AppException("Chỉ người nhận tiền mới có quyền duyệt xác nhận đã nhận tiền", HttpStatus.FORBIDDEN);
        }

        if (request.getStatus() != PaymentRequestStatus.WAITING_APPROVE) {
            throw new AppException("Yêu cầu này chưa được người nợ bấm xác nhận chuyển tiền (WAITING_APPROVE)", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        request.setStatus(PaymentRequestStatus.COMPLETED);
        request.setCompletedAt(now);
        PaymentRequest saved = paymentRequestRepository.save(request);

        // Đánh dấu TransactionSharingMember là đã thanh toán
        TransactionSharingMember sharingMember = request.getSharingMember();
        sharingMember.setIsPaid(true);
        sharingMember.setPaidAt(now);
        sharingMemberRepository.save(sharingMember);

        // Cập nhật lại số dư công nợ của User và GroupMember
        Long amount = request.getAmount();
        User debtor = request.getDebtor();
        User creditor = request.getCreditor();
        Group group = request.getTransaction().getGroup();

        debtor.setBalance(debtor.getBalance() + amount);
        creditor.setBalance(creditor.getBalance() - amount);
        userRepository.save(debtor);
        userRepository.save(creditor);

        groupMemberRepository.findByGroupIdAndUserId(group.getId(), debtor.getId())
                .ifPresent(gm -> {
                    gm.setBalance(gm.getBalance() + amount);
                    groupMemberRepository.save(gm);
                });

        groupMemberRepository.findByGroupIdAndUserId(group.getId(), creditor.getId())
                .ifPresent(gm -> {
                    gm.setBalance(gm.getBalance() - amount);
                    groupMemberRepository.save(gm);
                });

        // Ghi nhận EmailOutbox báo cho người nợ (Debtor)
        try {
            String businessKey = "PAYMENT_APPROVED:" + saved.getId() + ":" + saved.getVersion();
            String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + saved.getId();
            String message = "Chủ nợ (" + saved.getCreditor().getFullName() + ") đã xác nhận nhận tiền cho khoản nợ \"" + saved.getTransaction().getTitle() + "\". Khoản nợ đã được hoàn tất thành công.";
            String html = emailService.buildPaymentNotificationHtml(
                    "Thanh Toán Đã Được Duyệt Thành Công",
                    saved.getDebtor().getFullName(),
                    message,
                    saved.getAmount(),
                    saved.getNote(),
                    "Xem Chi Tiết Yêu Cầu",
                    actionUrl
            );

            emailOutboxService.recordOutbox(
                    EmailType.PAYMENT_APPROVED,
                    saved.getDebtor().getEmail(),
                    saved.getDebtor().getFullName(),
                    "Khoản nợ đã hoàn tất: " + saved.getTransaction().getTitle(),
                    html,
                    null,
                    businessKey,
                    LocalDate.now()
            );
        } catch (Exception e) {
            log.error("Lỗi khi ghi Outbox PAYMENT_APPROVED cho request {}: {}", saved.getId(), e.getMessage());
        }

        return mapToResponse(saved);
    }

    @Transactional
    public PaymentRequestResponse rejectPayment(UUID requestId, CustomUserDetails currentUser) {
        PaymentRequest request = paymentRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Yêu cầu thanh toán không tồn tại", HttpStatus.NOT_FOUND));

        if (!request.getCreditor().getId().equals(currentUser.getId())) {
            throw new AppException("Chỉ người nhận tiền mới có quyền từ chối / yêu cầu thanh toán lại", HttpStatus.FORBIDDEN);
        }

        if (request.getStatus() != PaymentRequestStatus.WAITING_APPROVE) {
            throw new AppException("Chỉ có thể từ chối khi yêu cầu đang ở trạng thái chờ duyệt (WAITING_APPROVE)", HttpStatus.BAD_REQUEST);
        }

        int nextRejection = (request.getRejectionCount() == null ? 0 : request.getRejectionCount()) + 1;
        request.setRejectionCount(nextRejection);
        request.setStatus(PaymentRequestStatus.PENDING);
        request.setDebtorConfirmedAt(null);
        PaymentRequest saved = paymentRequestRepository.save(request);

        // Ghi nhận EmailOutbox báo cho người nợ (Debtor)
        try {
            String businessKey = "PAYMENT_REJECTED:" + saved.getId() + ":" + nextRejection;
            String actionUrl = emailService.getDashboardUrl() + "/payment-requests/" + saved.getId();
            String message = "Chủ nợ (" + saved.getCreditor().getFullName() + ") đã từ chối xác nhận nhận tiền cho khoản nợ \"" + saved.getTransaction().getTitle() + "\". Vui lòng kiểm tra lại giao dịch hoặc chuyển khoản lại.";
            String html = emailService.buildPaymentNotificationHtml(
                    "Yêu Cầu Thanh Toán Bị Từ Chối",
                    saved.getDebtor().getFullName(),
                    message,
                    saved.getAmount(),
                    saved.getNote(),
                    "Thanh Toán Lại",
                    actionUrl
            );

            emailOutboxService.recordOutbox(
                    EmailType.PAYMENT_REJECTED,
                    saved.getDebtor().getEmail(),
                    saved.getDebtor().getFullName(),
                    "Yêu cầu thanh toán chưa được duyệt: " + saved.getTransaction().getTitle(),
                    html,
                    null,
                    businessKey,
                    LocalDate.now()
            );
        } catch (Exception e) {
            log.error("Lỗi khi ghi Outbox PAYMENT_REJECTED cho request {}: {}", saved.getId(), e.getMessage());
        }

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public PaymentRequestResponse getPaymentRequestDetail(UUID requestId, CustomUserDetails currentUser) {
        PaymentRequest request = paymentRequestRepository.findById(requestId)
                .orElseThrow(() -> new AppException("Yêu cầu thanh toán không tồn tại", HttpStatus.NOT_FOUND));

        boolean isAdmin = currentUser.getUser().getRole() == Role.ADMIN;
        boolean isParty = request.getDebtor().getId().equals(currentUser.getId()) || request.getCreditor().getId().equals(currentUser.getId());

        if (!isAdmin && !isParty) {
            throw new AppException("Bạn không có quyền truy cập yêu cầu thanh toán này", HttpStatus.FORBIDDEN);
        }

        return mapToResponse(request);
    }

    private PaymentRequestResponse mapToResponse(PaymentRequest pr) {
        User debtor = pr.getDebtor();
        User creditor = pr.getCreditor();

        UserResponse debtorRes = UserResponse.builder()
                .id(debtor.getId())
                .email(debtor.getEmail())
                .fullName(debtor.getFullName())
                .role(debtor.getRole())
                .balance(debtor.getBalance())
                .build();

        UserResponse creditorRes = UserResponse.builder()
                .id(creditor.getId())
                .email(creditor.getEmail())
                .fullName(creditor.getFullName())
                .role(creditor.getRole())
                .balance(creditor.getBalance())
                .build();

        String qrUrl = paymentInfoRepository.findByUserId(creditor.getId())
                .map(info -> info.buildQrUrl(pr.getAmount(), pr.getNote()))
                .orElse(null);

        return PaymentRequestResponse.builder()
                .id(pr.getId())
                .transactionId(pr.getTransaction().getId())
                .transactionTitle(pr.getTransaction().getTitle())
                .debtor(debtorRes)
                .creditor(creditorRes)
                .amount(pr.getAmount())
                .status(pr.getStatus())
                .note(pr.getNote())
                .qrUrl(qrUrl)
                .debtorConfirmedAt(pr.getDebtorConfirmedAt())
                .completedAt(pr.getCompletedAt())
                .createdAt(pr.getCreatedAt())
                .build();
    }
}
