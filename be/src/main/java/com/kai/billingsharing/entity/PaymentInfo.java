package com.kai.billingsharing.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Nationalized;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payment_info")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentInfo {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "bank_code", nullable = false)
    private String bankCode;

    @Nationalized
    @Column(name = "bank_name", columnDefinition = "NVARCHAR(255)")
    private String bankName;

    @Column(name = "account_number", nullable = false)
    private String accountNumber;

    @Nationalized
    @Column(name = "account_holder_name", nullable = false, columnDefinition = "NVARCHAR(255)")
    private String accountHolderName;

    @Column(name = "sepay_api_key", length = 255)
    private String sepayApiKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String buildQrUrl(Long amount, String description) {
        StringBuilder url = new StringBuilder("https://vietqr.app/img");
        url.append("?acc=").append(accountNumber);
        url.append("&bank=").append(bankCode);
        if (amount != null && amount > 0) {
            url.append("&amount=").append(amount);
        }
        if (description != null && !description.isBlank()) {
            url.append("&des=").append(URLEncoder.encode(description, StandardCharsets.UTF_8));
        }
        url.append("&template=compact");
        if (accountHolderName != null && !accountHolderName.isBlank()) {
            url.append("&holder=").append(URLEncoder.encode(accountHolderName, StandardCharsets.UTF_8));
        }
        return url.toString();
    }
}
