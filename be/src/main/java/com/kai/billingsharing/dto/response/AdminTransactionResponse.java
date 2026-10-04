package com.kai.billingsharing.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AdminTransactionResponse(
        UUID id, String title, Long totalAmount, UUID groupId, String groupName,
        UUID payerId, String payerName, boolean isPaid, boolean isAdjustment,
        String adjustmentType, LocalDateTime createdAt,
        List<SharingMemberDetailResponse> sharingMembers) {}
