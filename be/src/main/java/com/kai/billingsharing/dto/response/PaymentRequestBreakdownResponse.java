package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestBreakdownResponse {
    private Long grossDebt;        // Tổng nợ gốc ban đầu (VD: 80.000)
    private Long nettedCredit;     // Tổng số tiền được cấn trừ (VD: 30.000)
    private Long netAmount;        // Số tiền thực chuyển sau cấn trừ (VD: 50.000)
    private String formula;        // Công thức giải trình trực quan
    private String periodTitle;    // Tên khoản nợ lấy theo kỳ sao kê (VD: Kỳ sao kê 1/9 - 1/10)
    private String debtorName;
    private String creditorName;

    // Multilateral netting (Cấn trừ nợ đa phương)
    private Long directDebtAmount;        // Nợ trực tiếp với chủ nợ (VD: 100.000)
    private Long transferredDebtAmount;   // Nhận nợ thay thành viên khác (+10.000)
    private Long offsetCreditAmount;      // Được giảm nợ do thành viên khác trả thay (-10.000)
    private String nettingDetailNote;     // Diễn giải chi tiết cấn trừ
    private UUID linkedPaymentRequestId;  // ID của PaymentRequest đối ứng
    private UUID transferredDebtorId;     // ID thành viên liên đới trong cấn trừ
    private String transferredDebtorName; // Tên thành viên liên đới
    @Builder.Default
    private List<UUID> transferredShareIds = new ArrayList<>(); // Danh sách shareId chuyển giao

    @Builder.Default
    private List<PaymentRequestItemResponse> debtItems = new ArrayList<>();   // Các hóa đơn nợ gốc

    @Builder.Default
    private List<PaymentRequestItemResponse> nettedItems = new ArrayList<>(); // Các hóa đơn cấn trừ từ chủ nợ
}
