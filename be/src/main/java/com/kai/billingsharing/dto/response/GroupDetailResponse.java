package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupDetailResponse {

    private UUID id;
    private String name;
    private List<Integer> summaryDayOfMonth;
    private UserResponse createdBy;
    private List<GroupMemberResponse> members;
    private LocalDateTime createdAt;
}
