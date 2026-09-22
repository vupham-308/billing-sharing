package com.kai.billingsharing.controller;

import com.kai.billingsharing.entity.Group;
import com.kai.billingsharing.entity.StatementPeriod;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.entity.Transaction;
import com.kai.billingsharing.entity.TransactionSharingMember;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.StatementPeriodRepository;
import com.kai.billingsharing.repository.TransactionRepository;
import com.kai.billingsharing.repository.TransactionSharingMemberRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StatementControllerTest {

    @Mock
    private StatementPeriodRepository statementPeriodRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private TransactionSharingMemberRepository sharingMemberRepository;

    @InjectMocks
    private StatementController statementController;

    @Test
    void testStatementController_NonMember_ReturnsForbidden() {
        UUID groupId = UUID.randomUUID();
        User nonMember = User.builder().id(UUID.randomUUID()).role(Role.USER).build();
        CustomUserDetails userDetails = new CustomUserDetails(nonMember);

        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, nonMember.getId())).thenReturn(false);

        AppException ex = assertThrows(AppException.class, () ->
                statementController.getGroupStatements(groupId, userDetails)
        );

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("không có quyền"));
    }

    @Test
    void testStatementPeriod_SnapshotIntegrity_PreservesSnapshotData() {
        UUID groupId = UUID.randomUUID();
        UUID periodId = UUID.randomUUID();
        User member = User.builder().id(UUID.randomUUID()).role(Role.USER).build();
        CustomUserDetails userDetails = new CustomUserDetails(member);

        Group group = Group.builder().id(groupId).name("Nhóm Test").build();
        String sampleSnapshotJson = "{\"groupId\":\"" + groupId + "\",\"totalPendingAmount\":500000,\"items\":[{\"debtorName\":\"An\",\"amount\":500000}]}";

        StatementPeriod period = StatementPeriod.builder()
                .id(periodId)
                .group(group)
                .periodNumber(1)
                .startDate(LocalDateTime.now().minusMonths(1))
                .endDate(LocalDateTime.now())
                .snapshotJson(sampleSnapshotJson)
                .status("PROCESSED")
                .build();

        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, member.getId())).thenReturn(true);
        when(statementPeriodRepository.findById(periodId)).thenReturn(Optional.of(period));
        when(transactionRepository.findByGroupIdAndDateRange(eq(groupId), any(), any())).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> response = statementController.getStatementDetail(groupId, periodId, userDetails);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(periodId, response.getBody().get("id"));
        assertNotNull(response.getBody().get("snapshot"));
        assertNotNull(response.getBody().get("transactions"));
        assertNotNull(response.getBody().get("userSummary"));
        Map<?, ?> snapshotMap = (Map<?, ?>) response.getBody().get("snapshot");
        assertEquals(500000, snapshotMap.get("totalPendingAmount"));
    }

    @Test
    void testGetStatementDetail_WithTransactionsAndUserSummary() {
        UUID groupId = UUID.randomUUID();
        UUID periodId = UUID.randomUUID();
        User currentUser = User.builder().id(UUID.randomUUID()).fullName("User Me").role(Role.USER).build();
        User payerUser = User.builder().id(UUID.randomUUID()).fullName("Payer Friend").role(Role.USER).build();
        CustomUserDetails userDetails = new CustomUserDetails(currentUser);

        Group group = Group.builder().id(groupId).name("Nhóm Test").build();
        UUID txId = UUID.randomUUID();
        Transaction tx = Transaction.builder()
                .id(txId)
                .title("Ăn trưa")
                .totalAmount(300000L)
                .payer(payerUser)
                .group(group)
                .createdAt(LocalDateTime.now().minusDays(5))
                .build();

        TransactionSharingMember smMe = TransactionSharingMember.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .user(currentUser)
                .shareAmount(100000L)
                .isPaid(false)
                .build();

        String snapshotJson = "{\"groupId\":\"" + groupId + "\",\"items\":[{\"debtorId\":\"" + currentUser.getId() + "\",\"creditorId\":\"" + payerUser.getId() + "\",\"amount\":100000}]}";

        StatementPeriod period = StatementPeriod.builder()
                .id(periodId)
                .group(group)
                .periodNumber(1)
                .startDate(LocalDateTime.now().minusMonths(1))
                .endDate(LocalDateTime.now())
                .snapshotJson(snapshotJson)
                .status("PROCESSED")
                .build();

        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUser.getId())).thenReturn(true);
        when(statementPeriodRepository.findById(periodId)).thenReturn(Optional.of(period));
        when(transactionRepository.findByGroupIdAndDateRange(eq(groupId), any(), any())).thenReturn(List.of(tx));
        when(sharingMemberRepository.findByTransactionIdIn(List.of(txId))).thenReturn(List.of(smMe));

        ResponseEntity<Map<String, Object>> response = statementController.getStatementDetail(groupId, periodId, userDetails);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> txList = (List<Map<String, Object>>) response.getBody().get("transactions");
        assertEquals(1, txList.size());
        assertEquals("Ăn trưa", txList.get(0).get("title"));
        assertEquals(300000L, txList.get(0).get("totalAmount"));
        assertEquals("Payer Friend", txList.get(0).get("payerName"));
        assertEquals(100000L, txList.get(0).get("currentUserShare"));
        assertEquals(false, txList.get(0).get("isUserPayer"));

        @SuppressWarnings("unchecked")
        Map<String, Object> userSummary = (Map<String, Object>) response.getBody().get("userSummary");
        assertEquals(100000L, userSummary.get("userGrossDebt"));
        assertEquals(100000L, userSummary.get("totalToTransfer"));
    }
}
