package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.response.PaymentQrResponse;
import com.kai.billingsharing.dto.response.PaymentRequestResponse;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.service.PaymentRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payment-requests")
@RequiredArgsConstructor
public class PaymentRequestController {

    private final PaymentRequestService paymentRequestService;

    @GetMapping
    public ResponseEntity<Object> getMyPaymentRequests(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) PaymentRequestStatus status,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        Object response = paymentRequestService.getMyPaymentRequests(type, status, currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/qr")
    public ResponseEntity<PaymentQrResponse> getPaymentQr(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentQrResponse response = paymentRequestService.getPaymentQr(id, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/confirm-payment")
    public ResponseEntity<PaymentRequestResponse> confirmPayment(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentRequestResponse response = paymentRequestService.confirmPayment(id, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<PaymentRequestResponse> approvePayment(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentRequestResponse response = paymentRequestService.approvePayment(id, currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my-debts")
    public ResponseEntity<Object> getMyDebts(
            @RequestParam(required = false) PaymentRequestStatus status,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        Object response = paymentRequestService.getMyPaymentRequests("DEBT", status, currentUser);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/my-credits")
    public ResponseEntity<Object> getMyCredits(
            @RequestParam(required = false) PaymentRequestStatus status,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        Object response = paymentRequestService.getMyPaymentRequests("CREDIT", status, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/confirm-paid")
    public ResponseEntity<PaymentRequestResponse> confirmPaid(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentRequestResponse response = paymentRequestService.confirmPayment(id, currentUser);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<PaymentRequestResponse> rejectPayment(
            @PathVariable UUID id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentRequestResponse response = paymentRequestService.rejectPayment(id, currentUser);
        return ResponseEntity.ok(response);
    }
}
