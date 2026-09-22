package com.kai.billingsharing.dto.response;

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
public class PaymentInfoResponse {

    private UUID id;
    private String bankCode;
    private String bankName;
    private String accountNumber;
    private String accountHolderName;
    private String sepayApiKey;
    private Boolean hasSepayApiKey;
    private LocalDateTime updatedAt;
}
