package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.CreateTransactionRequest;
import com.kai.billingsharing.dto.request.ShareItemRequest;
import com.kai.billingsharing.dto.response.*;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final TransactionSharingMemberRepository sharingMemberRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    @Transactional
    public TransactionDetailResponse createTransaction(UUID groupId, CreateTransactionRequest request, CustomUserDetails currentUser) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new AppException("Nhóm không tồn tại", HttpStatus.NOT_FOUND));

        UUID currentUserId = currentUser.getId();

        // 1. Người tạo (cũng chính là Payer) bắt buộc phải là thành viên trong nhóm
        GroupMember payerGroupMember = groupMemberRepository.findByGroupIdAndUserId(groupId, currentUserId)
                .orElseThrow(() -> new AppException("Bạn không phải là thành viên của nhóm này", HttpStatus.FORBIDDEN));

        User payer = currentUser.getUser();

        // 2. Kiểm tra danh sách chia tiền
        List<ShareItemRequest> shares = request.getShares();
        if (shares == null || shares.isEmpty()) {
            throw new AppException("Danh sách chia tiền không được để trống", HttpStatus.BAD_REQUEST);
        }

        // Kiểm tra tổng số tiền chia có khớp với tổng hóa đơn không
        long sumShareAmount = shares.stream().mapToLong(ShareItemRequest::getShareAmount).sum();
        if (sumShareAmount != request.getTotalAmount()) {
            throw new AppException("Tổng tiền chia cho các thành viên (" + sumShareAmount + " VND) không khớp với tổng tiền hóa đơn (" + request.getTotalAmount() + " VND)", HttpStatus.BAD_REQUEST);
        }

        // 3. Kiểm tra tất cả các user được chia tiền có phải là thành viên nhóm không
        Map<UUID, User> memberUsersMap = new HashMap<>();
        Map<UUID, GroupMember> groupMembersMap = new HashMap<>();

        for (ShareItemRequest shareItem : shares) {
            UUID memberUserId = shareItem.getUserId();
            if (!memberUsersMap.containsKey(memberUserId)) {
                GroupMember gm = groupMemberRepository.findByGroupIdAndUserId(groupId, memberUserId)
                        .orElseThrow(() -> new AppException("Thành viên với ID " + memberUserId + " không thuộc nhóm này", HttpStatus.BAD_REQUEST));
                groupMembersMap.put(memberUserId, gm);
                memberUsersMap.put(memberUserId, gm.getUser());
            }
        }

        // 4. Lưu Transaction
        Transaction transaction = Transaction.builder()
                .title(request.getTitle().trim())
                .totalAmount(request.getTotalAmount())
                .payer(payer)
                .group(group)
                .build();
        Transaction savedTransaction = transactionRepository.save(transaction);

        // 5. Lưu TransactionSharingMember và cập nhật Balance
        List<TransactionSharingMember> savedSharingMembers = new ArrayList<>();
        long payerOwnShare = 0L;
        long totalOthersOwe = 0L;
        LocalDateTime now = LocalDateTime.now();

        for (ShareItemRequest shareItem : shares) {
            UUID memberUserId = shareItem.getUserId();
            User memberUser = memberUsersMap.get(memberUserId);
            GroupMember memberGroupMember = groupMembersMap.get(memberUserId);
            boolean isPayerShare = memberUserId.equals(currentUserId);

            TransactionSharingMember sharingMember = TransactionSharingMember.builder()
                    .transaction(savedTransaction)
                    .user(memberUser)
                    .shareAmount(shareItem.getShareAmount())
                    .isPaid(isPayerShare)
                    .paidAt(isPayerShare ? now : null)
                    .build();
            savedSharingMembers.add(sharingMemberRepository.save(sharingMember));

            if (isPayerShare) {
                payerOwnShare += shareItem.getShareAmount();
            } else {
                totalOthersOwe += shareItem.getShareAmount();
                // Ghi nợ cho thành viên khác
                memberUser.setBalance(memberUser.getBalance() - shareItem.getShareAmount());
                memberGroupMember.setBalance(memberGroupMember.getBalance() - shareItem.getShareAmount());
                userRepository.save(memberUser);
                groupMemberRepository.save(memberGroupMember);
            }
        }

        // Cập nhật số dư cho Payer (được các thành viên khác nợ)
        payer.setBalance(payer.getBalance() + totalOthersOwe);
        payerGroupMember.setBalance(payerGroupMember.getBalance() + totalOthersOwe);
        userRepository.save(payer);
        groupMemberRepository.save(payerGroupMember);

        return buildDetailResponse(savedTransaction, savedSharingMembers, currentUserId);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionDetailResponse> getGroupTransactions(
            UUID groupId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable,
            CustomUserDetails currentUser
    ) {
        return getGroupTransactions(groupId, startDate, endDate, null, pageable, currentUser);
    }

    @Transactional(readOnly = true)
    public PageResponse<TransactionDetailResponse> getGroupTransactions(
            UUID groupId,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Boolean isPaid,
            Pageable pageable,
            CustomUserDetails currentUser
    ) {
        UUID currentUserId = currentUser.getId();

        // Kiểm tra quyền truy cập nhóm
        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(groupId, currentUserId);
        if (!isMember) {
            throw new AppException("Bạn không có quyền truy cập hóa đơn của nhóm này", HttpStatus.FORBIDDEN);
        }

        // Truy vấn phân trang, lọc theo trạng thái isPaid của user nếu có
        Page<Transaction> pageData;
        if (isPaid != null) {
            pageData = transactionRepository.findGroupTransactionsForUserWithStatus(
                    groupId,
                    currentUserId,
                    startDate,
                    endDate,
                    isPaid,
                    pageable
            );
        } else {
            pageData = transactionRepository.findGroupTransactionsForUser(
                    groupId,
                    currentUserId,
                    startDate,
                    endDate,
                    pageable
            );
        }

        if (pageData.isEmpty()) {
            return PageResponse.of(pageData, Collections.emptyList());
        }

        List<UUID> transactionIds = pageData.getContent().stream().map(Transaction::getId).toList();
        List<TransactionSharingMember> allShares = sharingMemberRepository.findByTransactionIdIn(transactionIds);

        Map<UUID, List<TransactionSharingMember>> sharesByTxId = allShares.stream()
                .collect(Collectors.groupingBy(s -> s.getTransaction().getId()));

        List<TransactionDetailResponse> content = pageData.getContent().stream().map(tx -> {
            List<TransactionSharingMember> txShares = sharesByTxId.getOrDefault(tx.getId(), Collections.emptyList());
            return buildDetailResponse(tx, txShares, currentUserId);
        }).toList();

        return PageResponse.of(pageData, content);
    }

    @Transactional(readOnly = true)
    public TransactionDetailResponse getTransactionDetail(UUID transactionId, CustomUserDetails currentUser) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Hóa đơn không tồn tại", HttpStatus.NOT_FOUND));

        UUID currentUserId = currentUser.getId();
        boolean isMember = groupMemberRepository.existsByGroupIdAndUserId(tx.getGroup().getId(), currentUserId);
        if (!isMember) {
            throw new AppException("Bạn không có quyền xem hóa đơn này", HttpStatus.FORBIDDEN);
        }

        List<TransactionSharingMember> shares = sharingMemberRepository.findByTransactionId(transactionId);
        return buildDetailResponse(tx, shares, currentUserId);
    }

    private TransactionDetailResponse buildDetailResponse(
            Transaction tx,
            List<TransactionSharingMember> shares,
            UUID currentUserId
    ) {
        MyShareResponse myShare = null;
        List<SharingMemberDetailResponse> memberDetails = new ArrayList<>();

        for (TransactionSharingMember s : shares) {
            SharingMemberDetailResponse detail = SharingMemberDetailResponse.builder()
                    .id(s.getId())
                    .userId(s.getUser().getId())
                    .email(s.getUser().getEmail())
                    .fullName(s.getUser().getFullName())
                    .shareAmount(s.getShareAmount())
                    .isPaid(s.getIsPaid())
                    .paidAt(s.getPaidAt())
                    .build();
            memberDetails.add(detail);

            if (s.getUser().getId().equals(currentUserId)) {
                myShare = MyShareResponse.builder()
                        .shareAmount(s.getShareAmount())
                        .isPaid(s.getIsPaid())
                        .paidAt(s.getPaidAt())
                        .build();
            }
        }

        User payer = tx.getPayer();
        UserResponse payerResponse = UserResponse.builder()
                .id(payer.getId())
                .email(payer.getEmail())
                .fullName(payer.getFullName())
                .role(payer.getRole())
                .balance(payer.getBalance())
                .build();

        boolean isPayer = payer.getId().equals(currentUserId);
        boolean isUserPaid = isPayer || (myShare != null && Boolean.TRUE.equals(myShare.getIsPaid()));
        String status = isUserPaid ? "PAID" : "UNPAID";

        return TransactionDetailResponse.builder()
                .id(tx.getId())
                .title(tx.getTitle())
                .totalAmount(tx.getTotalAmount())
                .payer(payerResponse)
                .groupId(tx.getGroup().getId())
                .status(status)
                .isPaid(isUserPaid)
                .myShare(myShare)
                .sharingMembers(memberDetails)
                .createdAt(tx.getCreatedAt())
                .updatedAt(tx.getUpdatedAt())
                .build();
    }
}
