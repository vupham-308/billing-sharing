package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestBreakdownResponse {
    private Long grossDebt;        // Tổng nợ gốc ban đầu (VD: 80.000)
    private Long nettedCredit;     // Tổng số tiền được cấn trừ (VD: 30.000)
    private Long netAmount;        // Số tiền thực chuyển sau cấn trừ (VD: 50.000)
    private String formula;        // Công thức giải trình trực quan
    private String debtorName;
    private String creditorName;

    @Builder.Default
    private List<PaymentRequestItemResponse> debtItems = new ArrayList<>();   // Các hóa đơn nợ gốc

    @Builder.Default
    private List<PaymentRequestItemResponse> nettedItems = new ArrayList<>(); // Các hóa đơn cấn trừ từ chủ nợ
}
