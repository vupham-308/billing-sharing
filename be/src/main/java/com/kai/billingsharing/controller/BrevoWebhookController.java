package com.kai.billingsharing.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import com.kai.billingsharing.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class BrevoWebhookController {

    private final EmailOutboxRepository emailOutboxRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${brevo.webhook-secret:}")
    private String configuredSecret;

    @PostMapping("/brevo")
    public ResponseEntity<Map<String, String>> handleBrevoWebhook(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String webhookSecretHeader,
            @RequestParam(value = "secret", required = false) String secretParam,
            @RequestParam(value = "token", required = false) String tokenParam,
            @RequestBody String rawBody
    ) {
        log.info("Nhận Brevo Webhook payload: {}", rawBody);

        // 1. Kiểm tra secret nếu có cấu hình trong hệ thống
        if (configuredSecret != null && !configuredSecret.isBlank()) {
            String trimmedSecret = configuredSecret.trim();
            boolean matchHeader = webhookSecretHeader != null && trimmedSecret.equals(webhookSecretHeader.trim());
            boolean matchSecretParam = secretParam != null && trimmedSecret.equals(secretParam.trim());
            boolean matchTokenParam = tokenParam != null && trimmedSecret.equals(tokenParam.trim());

            if (!matchHeader && !matchSecretParam && !matchTokenParam) {
                log.warn("Brevo Webhook bị từ chối: Sai hoặc thiếu webhook secret (header hoặc query param).");
                throw new AppException("Webhook secret không hợp lệ", HttpStatus.UNAUTHORIZED);
            }
        }

        try {
            JsonNode root = objectMapper.readTree(rawBody);
            if (root.isArray()) {
                for (JsonNode eventNode : root) {
                    processSingleEvent(eventNode);
                }
            } else if (root.isObject()) {
                processSingleEvent(root);
            }
        } catch (Exception e) {
            log.error("Lỗi khi xử lý Brevo webhook JSON: {}", e.getMessage(), e);
        }

        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    private void processSingleEvent(JsonNode node) {
        String event = node.has("event") ? node.get("event").asText() : "";
        String messageId = node.has("message-id") ? node.get("message-id").asText() : null;

        // 2. Tìm kiếm Outbox theo Correlation Tag (ưu tiên số 1)
        UUID outboxId = extractOutboxIdFromTags(node);
        Optional<EmailOutbox> outboxOpt = Optional.empty();

        if (outboxId != null) {
            outboxOpt = emailOutboxRepository.findById(outboxId);
        }

        // Fallback: Tìm theo providerMessageId
        if (outboxOpt.isEmpty() && messageId != null && !messageId.isBlank()) {
            outboxOpt = emailOutboxRepository.findByProviderMessageId(messageId);
        }

        if (outboxOpt.isEmpty()) {
            log.warn("Không tìm thấy EmailOutbox tương ứng với tag outboxId={} hoặc messageId={}", outboxId, messageId);
            return;
        }

        EmailOutbox outbox = outboxOpt.get();

        // 3. Xử lý các sự kiện Brevo
        if ("delivered".equalsIgnoreCase(event)) {
            // Idempotent: Nếu đã DELIVERED thì không ghi đè
            if ("DELIVERED".equalsIgnoreCase(outbox.getDeliveryStatus())) {
                log.debug("Outbox id={} đã DELIVERED trước đó, bỏ qua.", outbox.getId());
                return;
            }

            outbox.setDeliveryStatus("DELIVERED");
            // Webhook xác nhận đã gửi thành công -> Gỡ bỏ UNKNOWN hoặc cập nhật SENT
            outbox.setStatus(OutboxStatus.SENT);
            emailOutboxRepository.save(outbox);
            log.info("Brevo Webhook: Email outbox id={} đã DELIVERED thành công (Status -> SENT)", outbox.getId());

        } else if ("hard_bounce".equalsIgnoreCase(event)) {
            outbox.setDeliveryStatus("BOUNCED");
            emailOutboxRepository.save(outbox);

            // Đánh dấu người dùng có email bị bounce để cảnh báo
            userRepository.findByEmail(outbox.getRecipientEmail()).ifPresent(user -> {
                user.setIsEmailBounced(true);
                userRepository.save(user);
                log.warn("Brevo Webhook: Đã đánh dấu isEmailBounced=true cho user {}", user.getEmail());
            });

        } else {
            // Các sự kiện khác: opened, click, soft_bounce
            if (outbox.getDeliveryStatus() == null || !"DELIVERED".equalsIgnoreCase(outbox.getDeliveryStatus())) {
                outbox.setDeliveryStatus(event.toUpperCase());
                emailOutboxRepository.save(outbox);
            }
        }
    }

    private UUID extractOutboxIdFromTags(JsonNode node) {
        if (node.has("tags") && node.get("tags").isArray()) {
            for (JsonNode tagNode : node.get("tags")) {
                String tag = tagNode.asText();
                if (tag.startsWith("outbox-")) {
                    try {
                        return UUID.fromString(tag.substring("outbox-".length()));
                    } catch (Exception ignored) {}
                }
            }
        }
        if (node.has("tag")) {
            String tag = node.get("tag").asText();
            if (tag.startsWith("outbox-")) {
                try {
                    return UUID.fromString(tag.substring("outbox-".length()));
                } catch (Exception ignored) {}
            }
        }
        return null;
    }
}
