package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestItemResponse {
    private UUID transactionId;
    private String transactionTitle;
    private Long amount;
    private Boolean isNetted; // false: nợ gốc cần trả, true: khoản creditor nợ lại được cấn trừ
}
