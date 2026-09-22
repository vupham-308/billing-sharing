package com.kai.billingsharing.dto.response;

import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestResponse {

    private UUID id;
    private UUID transactionId;
    private String transactionTitle;
    private UserResponse debtor;
    private UserResponse creditor;
    private Long amount;
    private PaymentRequestStatus status;
    private String identify;
    private String note;
    private String qrUrl;
    private LocalDateTime debtorConfirmedAt;
    private LocalDateTime completedAt;
    private LocalDateTime createdAt;
}
