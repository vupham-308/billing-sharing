package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.exception.BrevoApiException;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final Environment environment;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, String> templateCache = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    @Value("${app.frontend-url:https://kaidz.xyz}")
    private String frontendUrl;

    @Value("${brevo.api-key:}")
    private String brevoApiKey;

    @Value("${brevo.sender-email:no-reply@kaidz.xyz}")
    private String senderEmail;

    @Value("${brevo.sender-name:Billing Sharing}")
    private String senderName;

    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    @PostConstruct
    public void validateProdStartup() {
        boolean isProd = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p.equalsIgnoreCase("prod") || p.equalsIgnoreCase("production"));
        if (isProd && (brevoApiKey == null || brevoApiKey.isBlank())) {
            throw new IllegalStateException("Môi trường Production yêu cầu cấu hình brevo.api-key hợp lệ!");
        }
    }

    /**
     * Gửi email trực tiếp qua Brevo SMTP REST API.
     * Trả về providerMessageId nếu thành công.
     * Ném BrevoApiException (nếu HTTP 4xx, 5xx) hoặc ConnectTimeoutException/SocketTimeoutException.
     */
    public String sendBrevoEmailRaw(String toEmail, String toName, String subject, String htmlContent, List<String> tags) throws Exception {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            throw new AppException("Chưa cấu hình brevo.api-key", HttpStatus.SERVICE_UNAVAILABLE);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", Map.of("email", senderEmail, "name", senderName));
        payload.put("to", List.of(Map.of("email", toEmail, "name", toName != null && !toName.isBlank() ? toName : toEmail)));
        payload.put("subject", subject);
        payload.put("htmlContent", htmlContent);

        if (tags != null && !tags.isEmpty()) {
            payload.put("tags", tags);
            payload.put("headers", Map.of("X-Correlation-Id", tags.get(0)));
        }

        String requestBody = objectMapper.writeValueAsString(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BREVO_API_URL))
                .header("api-key", brevoApiKey.trim())
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        int statusCode = response.statusCode();
        String responseBody = response.body();

        if (statusCode >= 200 && statusCode < 300) {
            String messageId = null;
            try {
                JsonNode root = objectMapper.readTree(responseBody);
                if (root.has("messageId")) {
                    messageId = root.get("messageId").asText();
                }
            } catch (Exception e) {
                log.warn("Không thể bóc tách messageId từ response Brevo: {}", responseBody);
            }
            log.info("Brevo đã tiếp nhận email thành công, HTTP {}, messageId={}", statusCode, messageId);
            return messageId;
        } else {
            log.error("Brevo trả về mã lỗi HTTP {}: {}", statusCode, responseBody);
            throw new BrevoApiException(statusCode, responseBody);
        }
    }

    // Helper tương thích ngược cho code cũ (nếu có)
    public void sendBrevoEmail(String toEmail, String toName, String subject, String htmlContent) {
        try {
            sendBrevoEmailRaw(toEmail, toName, subject, htmlContent, null);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            throw new AppException("Lỗi khi gửi email: " + e.getMessage(), HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    public void sendNewInvoiceDigest(NewInvoiceDigestReader.Digest digest) {
        String dateStr = digest.date().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String html = buildInvoiceDigestHtml(digest.name(), dateStr, digest.invoiceCount(), digest.totalDebt(), digest.totalCredit());
        sendBrevoEmail(digest.email(), digest.name(), "Tổng hợp hóa đơn mới ngày " + dateStr + " - Billing Sharing", html);
    }

    public void sendAccountVerificationEmail(String toEmail, String toName, String verifyLink, int expiryHours) {
        String html = buildAccountVerificationHtml(toName, verifyLink, expiryHours);
        sendBrevoEmail(toEmail, toName, "Kích hoạt tài khoản Billing Sharing của bạn", html);
    }

    public void sendPasswordResetEmail(String toEmail, String toName, String resetLink, int expiryMinutes) {
        String html = buildPasswordResetHtml(toName, resetLink, expiryMinutes);
        sendBrevoEmail(toEmail, toName, "Yêu cầu đặt lại mật khẩu - Billing Sharing", html);
    }

    public void sendMonthlyStatementEmail(String toEmail, String toName, String groupName, long totalDebt, List<String> details, String qrUrl) {
        String html = "<p>Sao kê nhóm " + escape(groupName) + ": " + money(totalDebt) + " VND</p>";
        sendBrevoEmail(toEmail, toName, "Sao kê chi tiêu nhóm " + groupName, html);
    }

    public void sendPaymentReminderEmail(String toEmail, String toName, String creditorName, long amount, String note, String qrUrl) {
        String html = "<p>Nhắc nợ: " + money(amount) + " VND từ " + escape(creditorName) + "</p>";
        sendBrevoEmail(toEmail, toName, "Nhắc nhở thanh toán - Billing Sharing", html);
    }

    public String loadTemplate(String path) {
        return templateCache.computeIfAbsent(path, p -> {
            try {
                ClassPathResource resource = new ClassPathResource(p);
                try (var stream = resource.getInputStream()) {
                    return StreamUtils.copyToString(stream, StandardCharsets.UTF_8);
                }
            } catch (Exception e) {
                log.error("Không thể nạp email template từ {}: {}", p, e.getMessage());
                throw new IllegalStateException("Không thể nạp email template: " + p, e);
            }
        });
    }

    public static String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    public static String money(long amount) {
        return String.format(java.util.Locale.forLanguageTag("vi-VN"), "%,d", amount);
    }

    public String getDashboardUrl() {
        String base = frontendUrl.replaceAll("/+$", "");
        return base.endsWith("/billing-sharing") ? base : base + "/billing-sharing";
    }

    public String buildInvoiceDigestHtml(String userName, String dateStr, int invoiceCount, long totalDebt, long totalCredit) {
        String template = loadTemplate("templates/email/invoice-digest.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{date}}", escape(dateStr))
                .replace("{{invoiceCount}}", String.valueOf(invoiceCount))
                .replace("{{totalDebt}}", money(totalDebt))
                .replace("{{totalCredit}}", money(totalCredit))
                .replace("{{dashboardUrl}}", escape(getDashboardUrl()));
    }

    public String buildPasswordResetHtml(String userName, String resetLink, int expiryMinutes) {
        String template = loadTemplate("templates/email/reset-password.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{resetLink}}", escape(resetLink))
                .replace("{{expiryMinutes}}", String.valueOf(expiryMinutes));
    }

    public String buildAccountVerificationHtml(String userName, String verifyLink, int expiryHours) {
        String template = loadTemplate("templates/email/verify-account.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{verifyLink}}", escape(verifyLink))
                .replace("{{expiryHours}}", String.valueOf(expiryHours));
    }

    public String buildPasswordChangedHtml(String userName, String changedTime, String resetPasswordUrl) {
        String template = loadTemplate("templates/email/password-changed.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{changedTime}}", escape(changedTime))
                .replace("{{resetPasswordUrl}}", escape(resetPasswordUrl));
    }

    public String buildPaymentNotificationHtml(String title, String greetingName, String message, long amount, String note, String actionButtonText, String actionUrl) {
        String template = loadTemplate("templates/email/payment-notification.html");
        return template
                .replace("{{title}}", escape(title))
                .replace("{{greetingName}}", greetingName != null && !greetingName.isBlank() ? escape(greetingName) : "bạn")
                .replace("{{message}}", escape(message))
                .replace("{{amount}}", money(amount))
                .replace("{{note}}", note != null ? escape(note) : "Chi tiêu chia tiền")
                .replace("{{actionButtonText}}", escape(actionButtonText))
                .replace("{{actionUrl}}", escape(actionUrl));
    }

    public String buildStatementHtml(String userName, String groupName, String periodTitle, long totalPendingDebt, String pendingRowsHtml, String waitingSectionHtml, String statementWebUrl) {
        String template = loadTemplate("templates/email/statement.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{groupName}}", escape(groupName))
                .replace("{{periodTitle}}", escape(periodTitle))
                .replace("{{totalPendingDebt}}", money(totalPendingDebt))
                .replace("{{pendingRowsHtml}}", pendingRowsHtml != null ? pendingRowsHtml : "<p>Không có khoản nợ nào cần thanh toán.</p>")
                .replace("{{waitingSectionHtml}}", waitingSectionHtml != null ? waitingSectionHtml : "")
                .replace("{{statementWebUrl}}", escape(statementWebUrl));
    }

    public String buildDebtReminderHtml(String userName, long totalDebt, int debtCount, String debtRowsHtml) {
        String template = loadTemplate("templates/email/debt-reminder.html");
        return template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{totalDebt}}", money(totalDebt))
                .replace("{{debtCount}}", String.valueOf(debtCount))
                .replace("{{debtRowsHtml}}", debtRowsHtml != null ? debtRowsHtml : "")
                .replace("{{dashboardUrl}}", escape(getDashboardUrl()));
    }
}
