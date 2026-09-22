package com.kai.billingsharing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.entity.StatementPeriod;
import com.kai.billingsharing.entity.Transaction;
import com.kai.billingsharing.entity.TransactionSharingMember;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupMemberRepository;
import com.kai.billingsharing.repository.StatementPeriodRepository;
import com.kai.billingsharing.repository.TransactionRepository;
import com.kai.billingsharing.repository.TransactionSharingMemberRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/groups/{groupId}/statements")
@RequiredArgsConstructor
public class StatementController {

    private final StatementPeriodRepository statementPeriodRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionSharingMemberRepository sharingMemberRepository;
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

        Object snapshotObj = null;
        try {
            snapshotObj = objectMapper.readValue(period.getSnapshotJson(), Object.class);
            response.put("snapshot", snapshotObj);
        } catch (Exception e) {
            log.error("Lỗi parse snapshotJson của period {}: {}", periodId, e.getMessage());
            response.put("snapshot", null);
        }

        // Truy vấn danh sách giao dịch chi tiết trong kỳ sao kê
        List<Transaction> transactions = transactionRepository.findByGroupIdAndDateRange(
                groupId, period.getStartDate(), period.getEndDate()
        );

        List<UUID> txIds = transactions.stream().map(Transaction::getId).toList();
        List<TransactionSharingMember> allShares = txIds.isEmpty() ? List.of() : sharingMemberRepository.findByTransactionIdIn(txIds);
        Map<UUID, List<TransactionSharingMember>> sharesByTx = allShares.stream()
                .collect(Collectors.groupingBy(s -> s.getTransaction().getId()));

        List<Map<String, Object>> txList = new ArrayList<>();
        long userGrossDebt = 0L;
        long userGrossCredit = 0L;

        for (Transaction t : transactions) {
            Map<String, Object> txMap = new LinkedHashMap<>();
            txMap.put("id", t.getId());
            txMap.put("title", t.getTitle());
            txMap.put("totalAmount", t.getTotalAmount());
            txMap.put("payerId", t.getPayer().getId());
            txMap.put("payerName", t.getPayer().getFullName());
            txMap.put("createdAt", t.getCreatedAt());

            boolean isUserPayer = t.getPayer().getId().equals(currentUser.getId());
            txMap.put("isUserPayer", isUserPayer);

            List<TransactionSharingMember> shares = sharesByTx.getOrDefault(t.getId(), List.of());
            long userShare = 0L;
            List<Map<String, Object>> memberShares = new ArrayList<>();
            for (TransactionSharingMember sm : shares) {
                if (sm.getUser().getId().equals(currentUser.getId())) {
                    userShare = sm.getShareAmount();
                }
                Map<String, Object> smMap = new LinkedHashMap<>();
                smMap.put("userId", sm.getUser().getId());
                smMap.put("userName", sm.getUser().getFullName());
                smMap.put("shareAmount", sm.getShareAmount());
                smMap.put("isPaid", Boolean.TRUE.equals(sm.getIsPaid()));
                memberShares.add(smMap);
            }
            txMap.put("currentUserShare", userShare);
            txMap.put("shares", memberShares);

            if (!isUserPayer && userShare > 0) {
                userGrossDebt += userShare;
            } else if (isUserPayer) {
                long othersOwe = t.getTotalAmount() - userShare;
                userGrossCredit += othersOwe;
            }

            txList.add(txMap);
        }
        response.put("transactions", txList);

        // Tính toán tổng kết các khoản cần chuyển / nhận của người dùng đang đăng nhập
        Map<String, Object> userSummary = new LinkedHashMap<>();
        userSummary.put("userGrossDebt", userGrossDebt);
        userSummary.put("userGrossCredit", userGrossCredit);

        long totalToTransfer = 0L;
        long totalToReceive = 0L;
        List<Map<String, Object>> myPaymentRequests = new ArrayList<>();

        if (snapshotObj instanceof Map<?, ?> snapMap) {
            Object itemsObj = snapMap.get("items");
            if (itemsObj instanceof List<?> itemsList) {
                for (Object itemObj : itemsList) {
                    if (itemObj instanceof Map<?, ?> itemMap) {
                        String debtorIdStr = String.valueOf(itemMap.get("debtorId"));
                        String creditorIdStr = String.valueOf(itemMap.get("creditorId"));
                        String myIdStr = currentUser.getId().toString();

                        Number amtNum = (Number) itemMap.get("amount");
                        long amt = amtNum != null ? amtNum.longValue() : 0L;

                        if (myIdStr.equalsIgnoreCase(debtorIdStr)) {
                            totalToTransfer += amt;
                            myPaymentRequests.add(new LinkedHashMap<>((Map<String, Object>) itemMap));
                        } else if (myIdStr.equalsIgnoreCase(creditorIdStr)) {
                            totalToReceive += amt;
                        }
                    }
                }
            }
        }

        userSummary.put("totalToTransfer", totalToTransfer);
        userSummary.put("totalToReceive", totalToReceive);
        userSummary.put("paymentRequests", myPaymentRequests);
        response.put("userSummary", userSummary);

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
