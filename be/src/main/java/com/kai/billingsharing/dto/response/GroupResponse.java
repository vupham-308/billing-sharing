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
public class GroupResponse {

    private UUID id;
    private String name;
    private Integer summaryDayOfMonth;
    private UUID createdById;
    private String createdByName;
    private Long myBalanceInGroup;
    private LocalDateTime createdAt;
}
