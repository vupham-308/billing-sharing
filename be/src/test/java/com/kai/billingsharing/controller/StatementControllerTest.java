package com.kai.billingsharing.controller;

import com.kai.billingsharing.entity.Group;
import com.kai.billingsharing.entity.StatementPeriod;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.StatementPeriodRepository;
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

        ResponseEntity<Map<String, Object>> response = statementController.getStatementDetail(groupId, periodId, userDetails);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(periodId, response.getBody().get("id"));
        assertNotNull(response.getBody().get("snapshot"));
        Map<?, ?> snapshotMap = (Map<?, ?>) response.getBody().get("snapshot");
        assertEquals(500000, snapshotMap.get("totalPendingAmount"));
    }
}
