package com.kai.billingsharing.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTransactionRequest {

    @NotBlank(message = "Tiêu đề hóa đơn không được để trống")
    private String title;

    @NotNull(message = "Tổng số tiền không được để trống")
    @Min(value = 1, message = "Tổng số tiền phải lớn hơn 0")
    private Long totalAmount;

    @NotEmpty(message = "Danh sách chia tiền không được để trống")
    @Valid
    private List<ShareItemRequest> shares;
}
