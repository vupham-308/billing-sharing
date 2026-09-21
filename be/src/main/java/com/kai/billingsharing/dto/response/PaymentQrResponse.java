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
public class PaymentQrResponse {

    private UUID requestId;
    private Long amount;
    private String bankCode;
    private String accountNumber;
    private String accountHolderName;
    private String description;
    private String qrUrl;
}
