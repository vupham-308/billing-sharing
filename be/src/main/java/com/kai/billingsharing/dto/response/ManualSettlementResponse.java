package com.kai.billingsharing.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManualSettlementResponse {

    private UUID groupId;
    private String groupName;
    private int paymentRequestsCreated;
    private int paymentRequestsExisting;
    private int pendingRequests;
    private int waitingApproveRequests;
    private boolean statementQueued;
}
