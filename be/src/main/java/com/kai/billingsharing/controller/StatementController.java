package com.kai.billingsharing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.StatementPeriod;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.StatementPeriodRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/groups/{groupId}/statements")
@RequiredArgsConstructor
public class StatementController {

    private final StatementPeriodRepository statementPeriodRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Lấy danh sách tất cả các kỳ sao kê của một nhóm.
     * Kiểm tra quyền: Phải là thành viên nhóm hoặc ADMIN.
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getGroupStatements(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        checkAccess(groupId, currentUser);

        List<StatementPeriod> periods = statementPeriodRepository.findByGroupIdOrderByPeriodNumberDesc(groupId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (StatementPeriod p : periods) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", p.getId());
            map.put("groupId", p.getGroup().getId());
            map.put("periodNumber", p.getPeriodNumber());
            map.put("startDate", p.getStartDate());
            map.put("endDate", p.getEndDate());
            map.put("processedAt", p.getProcessedAt());
            map.put("status", p.getStatus());
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Lấy chi tiết snapshot lịch sử của một kỳ sao kê cụ thể.
     * Trả về nguyên bản dữ liệu snapshotJson được chốt tại thời điểm kỳ chạy.
     */
    @GetMapping("/{periodId}")
    public ResponseEntity<Map<String, Object>> getStatementDetail(
            @PathVariable UUID groupId,
            @PathVariable UUID periodId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        checkAccess(groupId, currentUser);

        StatementPeriod period = statementPeriodRepository.findById(periodId)
                .orElseThrow(() -> new AppException("Không tìm thấy kỳ sao kê", HttpStatus.NOT_FOUND));

        if (!period.getGroup().getId().equals(groupId)) {
            throw new AppException("Kỳ sao kê không thuộc nhóm này", HttpStatus.BAD_REQUEST);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", period.getId());
        response.put("groupId", period.getGroup().getId());
        response.put("periodNumber", period.getPeriodNumber());
        response.put("startDate", period.getStartDate());
        response.put("endDate", period.getEndDate());
        response.put("processedAt", period.getProcessedAt());
        response.put("status", period.getStatus());

        try {
            Object snapshotObj = objectMapper.readValue(period.getSnapshotJson(), Object.class);
            response.put("snapshot", snapshotObj);
        } catch (Exception e) {
            log.error("Lỗi parse snapshotJson của period {}: {}", periodId, e.getMessage());
            response.put("snapshot", null);
        }

        return ResponseEntity.ok(response);
    }

    private void checkAccess(UUID groupId, CustomUserDetails currentUser) {
        boolean isAdmin = currentUser.getUser().getRole() == Role.ADMIN;
        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUser.getId());

        if (!isAdmin && !isMember) {
            throw new AppException("Bạn không có quyền xem thông tin sao kê của nhóm này", HttpStatus.FORBIDDEN);
        }
    }
}
