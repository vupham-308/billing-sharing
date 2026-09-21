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
public class TransactionDetailResponse {

    private UUID id;
    private String title;
    private Long totalAmount;
    private UserResponse payer;
    private UUID groupId;
    private MyShareResponse myShare;
    private List<SharingMemberDetailResponse> sharingMembers;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
