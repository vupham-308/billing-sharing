package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;
import com.kai.billingsharing.exception.AppException;
import org.springframework.http.HttpStatus;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

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

    public void sendNewInvoiceDigest(NewInvoiceDigestReader.Digest digest) {
        String date = digest.date().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
        String base = frontendUrl.replaceAll("/+$", "");
        String dashboard = base.endsWith("/billing-sharing") ? base : base + "/billing-sharing";
        String html = "<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto'>"
                + "<h2>Bạn có hóa đơn mới</h2><p>Xin chào " + escape(digest.name()) + ",</p>"
                + "<p>Bạn có tên trong danh sách chia tiền của <strong>" + digest.invoiceCount()
                + " hóa đơn</strong> được tạo ngày " + date + ".</p>"
                + "<h3>Công nợ hiện tại trên tất cả nhóm</h3>"
                + "<p>Tổng còn nợ: <strong>" + money(digest.totalDebt()) + " VND</strong></p>"
                + "<p>Tổng còn được nhận: <strong>" + money(digest.totalCredit()) + " VND</strong></p>"
                + "<p>Số liệu tại thời điểm lập thông báo, bao gồm các khoản đang chờ xác nhận nhận tiền. "
                + "Nếu đã chuyển và đang chờ duyệt, bạn không cần chuyển lại.</p>"
                + "<p><a href='" + escape(dashboard) + "'>Xem hóa đơn và công nợ</a></p></div>";
        sendBrevoEmail(digest.email(), digest.name(), "[Billing Sharing] Hóa đơn mới ngày " + date, html);
    }

    private static String money(long amount) {
        return String.format(java.util.Locale.forLanguageTag("vi-VN"), "%,d", amount);
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    public void sendPaymentReminderEmail(String toEmail, String debtorName, String creditorName, Long amount, String note, String qrUrl) {
        String subject = "[Billing Sharing] Nhắc nhở thanh toán nợ: " + (note != null ? note : "Hóa đơn chia tiền");
        String htmlContent = buildReminderEmailContent(debtorName, creditorName, amount, note, qrUrl);
        sendBrevoEmail(toEmail, debtorName, subject, htmlContent);
    }

    public void sendMonthlyStatementEmail(String toEmail, String memberName, String groupName, Long totalDebt, List<String> details, String qrUrl) {
        String subject = "[Billing Sharing] Sao kê tổng hợp chi tiêu tháng: Nhóm " + groupName;
        String htmlContent = buildMonthlyStatementContent(memberName, groupName, totalDebt, details, qrUrl);
        sendBrevoEmail(toEmail, memberName, subject, htmlContent);
    }

    public void sendPasswordResetEmail(String toEmail, String userName, String resetLink, int expiryMinutes) {
        String subject = "[Billing Sharing] Yêu cầu đặt lại mật khẩu của bạn";
        String template = loadTemplate("templates/email/reset-password.html");
        String htmlContent = template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{resetLink}}", escape(resetLink))
                .replace("{{expiryMinutes}}", String.valueOf(expiryMinutes));

        sendBrevoEmail(toEmail, userName, subject, htmlContent);
    }

    public void sendAccountVerificationEmail(String toEmail, String userName, String verifyLink, int expiryHours) {
        String subject = "[Billing Sharing] Xác nhận kích hoạt tài khoản của bạn";
        String template = loadTemplate("templates/email/verify-account.html");
        String htmlContent = template
                .replace("{{userName}}", userName != null && !userName.isBlank() ? escape(userName) : "bạn")
                .replace("{{verifyLink}}", escape(verifyLink))
                .replace("{{expiryHours}}", String.valueOf(expiryHours));

        sendBrevoEmail(toEmail, userName, subject, htmlContent);
    }


    private String loadTemplate(String path) {
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

    void sendBrevoEmail(String toEmail, String toName, String subject, String htmlContent) {
        if (brevoApiKey == null || brevoApiKey.isBlank()) {
            throw new AppException("Chưa cấu hình dịch vụ gửi email", HttpStatus.SERVICE_UNAVAILABLE);
        }

        try {
            Map<String, Object> payload = Map.of(
                    "sender", Map.of("email", senderEmail, "name", senderName),
                    "to", List.of(Map.of("email", toEmail, "name", toName != null ? toName : toEmail)),
                    "subject", subject,
                    "htmlContent", htmlContent
            );

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

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Brevo đã tiếp nhận email, HTTP {}", response.statusCode());
            } else {
                throw new AppException("Dịch vụ gửi email trả về lỗi HTTP " + response.statusCode(), HttpStatus.SERVICE_UNAVAILABLE);
            }
        } catch (AppException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AppException("Gửi email bị gián đoạn", HttpStatus.SERVICE_UNAVAILABLE);
        } catch (Exception e) {
            log.error("Không thể gửi email: {}", e.getClass().getSimpleName());
            throw new AppException("Không thể kết nối dịch vụ gửi email", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private String buildReminderEmailContent(String debtorName, String creditorName, Long amount, String note, String qrUrl) {
        debtorName = escape(debtorName);
        creditorName = escape(creditorName);
        note = note == null ? null : escape(note);
        qrUrl = qrUrl == null ? null : escape(qrUrl);
        return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>"
                + "<h2 style='color: #0284c7;'>Nhắc nhở thanh toán hóa đơn</h2>"
                + "<p>Xin chào <strong>" + debtorName + "</strong>,</p>"
                + "<p>Bạn có một khoản tiền cần thanh toán cho <strong>" + creditorName + "</strong>:</p>"
                + "<div style='background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;'>"
                + "<p style='margin: 5px 0;'><strong>Số tiền:</strong> <span style='color: #dc2626; font-size: 18px; font-weight: bold;'>" + String.format("%,d", amount) + " VND</span></p>"
                + "<p style='margin: 5px 0;'><strong>Nội dung:</strong> " + (note != null ? note : "Thanh toán chia tiền") + "</p>"
                + "</div>"
                + (qrUrl != null ? "<div style='text-align: center; margin: 20px 0;'><p><strong>Quét mã VietQR để thanh toán:</strong></p><img src='" + qrUrl + "' alt='VietQR' style='max-width: 250px; border: 1px solid #cbd5e1; border-radius: 8px;'/></div>" : "")
                + "<p>Sau khi chuyển khoản, vui lòng vào ứng dụng và bấm <strong>Xác nhận đã thanh toán</strong>.</p>"
                + "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'/>"
                + "<p style='color: #64748b; font-size: 12px;'>Billing Sharing System - Hệ thống chia sẻ chi phí tự động</p>"
                + "</div>";
    }

    private String buildMonthlyStatementContent(String memberName, String groupName, Long totalDebt, List<String> details, String qrUrl) {
        memberName = escape(memberName);
        groupName = escape(groupName);
        qrUrl = qrUrl == null ? null : escape(qrUrl);
        StringBuilder itemsHtml = new StringBuilder();
        if (details != null) {
            for (String item : details) {
                itemsHtml.append("<li style='margin-bottom: 6px;'>").append(escape(item)).append("</li>");
            }
        }

        return "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;'>"
                + "<h2 style='color: #0284c7;'>Sao kê tổng hợp chi tiêu tháng - Nhóm " + groupName + "</h2>"
                + "<p>Xin chào <strong>" + memberName + "</strong>,</p>"
                + "<p>Dưới đây là bảng tổng hợp các khoản chi tiêu của bạn trong nhóm đến ngày hôm nay:</p>"
                + "<ul>" + itemsHtml + "</ul>"
                + "<div style='background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0;'>"
                + "<p style='margin: 5px 0;'><strong>Tổng số tiền cần thanh toán:</strong> <span style='color: #dc2626; font-size: 20px; font-weight: bold;'>" + String.format("%,d", totalDebt) + " VND</span></p>"
                + "</div>"
                + (qrUrl != null ? "<div style='text-align: center; margin: 20px 0;'><p><strong>Mã QR thanh toán:</strong></p><img src='" + qrUrl + "' alt='VietQR' style='max-width: 250px; border: 1px solid #cbd5e1; border-radius: 8px;'/></div>" : "")
                + "<p>Vui lòng hoàn tất thanh toán trước kỳ kế tiếp.</p>"
                + "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'/>"
                + "<p style='color: #64748b; font-size: 12px;'>Billing Sharing System - Hệ thống chia sẻ chi phí tự động</p>"
                + "</div>";
    }
}
