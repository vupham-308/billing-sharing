package com.kai.billingsharing.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateGroupRequest {

    @NotBlank(message = "Tên nhóm không được để trống")
    private String name;

    @Min(value = 1, message = "Ngày tổng hợp phải từ 1 đến 31")
    @Max(value = 31, message = "Ngày tổng hợp phải từ 1 đến 31")
    private Integer summaryDayOfMonth;
}
