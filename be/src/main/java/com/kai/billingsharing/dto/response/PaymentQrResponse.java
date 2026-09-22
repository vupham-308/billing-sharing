package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentQrResponse {

    private UUID requestId;
    private String identify;
    private Long amount;
    private String bankCode;
    private String accountNumber;
    private String accountHolderName;
    private String description;
    private String qrUrl;
    private PaymentRequestStatus status;
    private String transactionTitle;
    private String groupName;
    private String creditorName;
    private Long originalAmount;
    private Long nettedAmount;
    private PaymentRequestBreakdownResponse breakdown;
}
