package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.webhook.SepayWebhookPayload;
import com.kai.billingsharing.service.PaymentRequestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks/sepay")
@RequiredArgsConstructor
public class SepayWebhookController {

    private final PaymentRequestService paymentRequestService;

    @PostMapping
    public ResponseEntity<Map<String, Object>> handleSepayWebhook(
            @RequestBody(required = false) SepayWebhookPayload payload,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestHeader(value = "X-Api-Key", required = false) String xApiKey
    ) {
        log.info("Nhận SePay Webhook: id={}, code={}, transferAmount={}, content={}",
                payload != null ? payload.getId() : null,
                payload != null ? payload.getCode() : null,
                payload != null ? payload.getTransferAmount() : null,
                payload != null ? payload.getContent() : null);

        Map<String, Object> result = paymentRequestService.processSepayWebhook(payload, authHeader, xApiKey);
        Boolean success = (Boolean) result.get("success");

        if (Boolean.FALSE.equals(success)) {
            String msg = (String) result.get("message");
            if (msg != null && (msg.contains("không hợp lệ") || msg.contains("Unauthorized"))) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(result);
            }
            return ResponseEntity.ok(result);
        }

        return ResponseEntity.ok(result);
    }
}
