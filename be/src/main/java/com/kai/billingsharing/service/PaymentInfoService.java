package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.UpdatePaymentInfoRequest;
import com.kai.billingsharing.dto.response.PaymentInfoResponse;
import com.kai.billingsharing.entity.PaymentInfo;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.PaymentInfoRepository;
import com.kai.billingsharing.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentInfoService {

    private final PaymentInfoRepository paymentInfoRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PaymentInfoResponse getMyPaymentInfo(UUID userId) {
        PaymentInfo info = paymentInfoRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Bạn chưa thiết lập thông tin thanh toán tài khoản ngân hàng", HttpStatus.NOT_FOUND));

        return mapToResponse(info);
    }

    @Transactional
    public PaymentInfoResponse updateMyPaymentInfo(UUID userId, UpdatePaymentInfoRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("Người dùng không tồn tại", HttpStatus.NOT_FOUND));

        PaymentInfo info = paymentInfoRepository.findByUserId(userId)
                .orElse(PaymentInfo.builder().user(user).build());

        info.setBankCode(request.getBankCode().trim());
        info.setBankName(request.getBankName() != null ? request.getBankName().trim() : null);
        info.setAccountNumber(request.getAccountNumber().trim());
        info.setAccountHolderName(request.getAccountHolderName().trim().toUpperCase());
        info.setSepayApiKey(request.getSepayApiKey() != null && !request.getSepayApiKey().isBlank() ? request.getSepayApiKey().trim() : null);

        PaymentInfo saved = paymentInfoRepository.save(info);
        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public String generateQrForUser(UUID userId, Long amount, String description) {
        Optional<PaymentInfo> infoOpt = paymentInfoRepository.findByUserId(userId);
        return infoOpt.map(info -> info.buildQrUrl(amount, description)).orElse(null);
    }

    private PaymentInfoResponse mapToResponse(PaymentInfo info) {
        return PaymentInfoResponse.builder()
                .id(info.getId())
                .bankCode(info.getBankCode())
                .bankName(info.getBankName())
                .accountNumber(info.getAccountNumber())
                .accountHolderName(info.getAccountHolderName())
                .sepayApiKey(info.getSepayApiKey())
                .hasSepayApiKey(info.getSepayApiKey() != null && !info.getSepayApiKey().isBlank())
                .updatedAt(info.getUpdatedAt())
                .build();
    }
}
