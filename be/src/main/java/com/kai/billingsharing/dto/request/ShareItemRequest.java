package com.kai.billingsharing.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShareItemRequest {

    @NotNull(message = "userId không được để trống")
    private UUID userId;

    @NotNull(message = "shareAmount không được để trống")
    @Min(value = 1, message = "Số tiền chia phải lớn hơn 0")
    private Long shareAmount;
}
