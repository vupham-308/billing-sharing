package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.request.UpdatePaymentInfoRequest;
import com.kai.billingsharing.dto.response.PaymentInfoResponse;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.service.PaymentInfoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payment-info")
@RequiredArgsConstructor
public class PaymentInfoController {

    private final PaymentInfoService paymentInfoService;

    @GetMapping("/me")
    public ResponseEntity<PaymentInfoResponse> getMyPaymentInfo(@AuthenticationPrincipal CustomUserDetails currentUser) {
        PaymentInfoResponse response = paymentInfoService.getMyPaymentInfo(currentUser.getId());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/me")
    public ResponseEntity<PaymentInfoResponse> updateMyPaymentInfo(
            @Valid @RequestBody UpdatePaymentInfoRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentInfoResponse response = paymentInfoService.updateMyPaymentInfo(currentUser.getId(), request);
        return ResponseEntity.ok(response);
    }
}
