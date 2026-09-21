package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.CreateTransactionRequest;
import com.kai.billingsharing.dto.request.ShareItemRequest;
import com.kai.billingsharing.dto.response.PageResponse;
import com.kai.billingsharing.dto.response.TransactionDetailResponse;
import com.kai.billingsharing.entity.Group;
import com.kai.billingsharing.entity.GroupMember;
import com.kai.billingsharing.entity.Transaction;
import com.kai.billingsharing.entity.TransactionSharingMember;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private TransactionSharingMemberRepository sharingMemberRepository;

    @Mock
    private GroupRepository groupRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private TransactionService transactionService;

    private User payer;
    private User debtor;
    private Group group;
    private GroupMember payerGroupMember;
    private GroupMember debtorGroupMember;
    private CustomUserDetails payerUserDetails;

    @BeforeEach
    void setUp() {
        payer = User.builder()
                .id(UUID.randomUUID())
                .email("payer@example.com")
                .fullName("Payer User")
                .role(Role.USER)
                .balance(0L)
                .build();
        payerUserDetails = new CustomUserDetails(payer);

        debtor = User.builder()
                .id(UUID.randomUUID())
                .email("debtor@example.com")
                .fullName("Debtor User")
                .role(Role.USER)
                .balance(0L)
                .build();

        group = Group.builder()
                .id(UUID.randomUUID())
                .name("Nhóm Test")
                .createdBy(payer)
                .build();

        payerGroupMember = GroupMember.builder()
                .id(UUID.randomUUID())
                .group(group)
                .user(payer)
                .balance(0L)
                .build();

        debtorGroupMember = GroupMember.builder()
                .id(UUID.randomUUID())
                .group(group)
                .user(debtor)
                .balance(0L)
                .build();
    }

    @Test
    void testCreateTransaction_Success_UpdatesBalances() {
        UUID groupId = group.getId();

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .title("Ăn lẩu")
                .totalAmount(200000L)
                .shares(List.of(
                        ShareItemRequest.builder().userId(payer.getId()).shareAmount(100000L).build(),
                        ShareItemRequest.builder().userId(debtor.getId()).shareAmount(100000L).build()
                ))
                .build();

        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(groupMemberRepository.findByGroupIdAndUserId(groupId, payer.getId())).thenReturn(Optional.of(payerGroupMember));
        when(groupMemberRepository.findByGroupIdAndUserId(groupId, debtor.getId())).thenReturn(Optional.of(debtorGroupMember));

        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction tx = i.getArgument(0);
            tx.setId(UUID.randomUUID());
            return tx;
        });

        when(sharingMemberRepository.save(any(TransactionSharingMember.class))).thenAnswer(i -> {
            TransactionSharingMember sm = i.getArgument(0);
            sm.setId(UUID.randomUUID());
            return sm;
        });

        TransactionDetailResponse response = transactionService.createTransaction(groupId, request, payerUserDetails);

        assertNotNull(response);
        assertEquals("Ăn lẩu", response.getTitle());
        assertEquals(200000L, response.getTotalAmount());
        assertEquals(payer.getId(), response.getPayer().getId());
        assertEquals(2, response.getSharingMembers().size());

        // Kiểm tra phần của Payer tự động isPaid = true
        assertTrue(response.getMyShare().getIsPaid());

        // Kiểm tra cập nhật Balance:
        // Payer chi 200k, ăn 100k -> được nợ 100k (+100k)
        assertEquals(100000L, payer.getBalance());
        assertEquals(100000L, payerGroupMember.getBalance());

        // Debtor ăn 100k -> nợ 100k (-100k)
        assertEquals(-100000L, debtor.getBalance());
        assertEquals(-100000L, debtorGroupMember.getBalance());
    }

    @Test
    void testCreateTransaction_TotalAmountMismatch_ThrowsBadRequest() {
        UUID groupId = group.getId();

        CreateTransactionRequest request = CreateTransactionRequest.builder()
                .title("Ăn lẩu")
                .totalAmount(200000L)
                .shares(List.of(
                        ShareItemRequest.builder().userId(payer.getId()).shareAmount(50000L).build(),
                        ShareItemRequest.builder().userId(debtor.getId()).shareAmount(50000L).build()
                )) // Tổng chỉ có 100k mà totalAmount = 200k
                .build();

        when(groupRepository.findById(groupId)).thenReturn(Optional.of(group));
        when(groupMemberRepository.findByGroupIdAndUserId(groupId, payer.getId())).thenReturn(Optional.of(payerGroupMember));

        AppException ex = assertThrows(AppException.class, () -> transactionService.createTransaction(groupId, request, payerUserDetails));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("không khớp với tổng tiền hóa đơn"));
    }

    @Test
    void testGetGroupTransactions_Pagination() {
        UUID groupId = group.getId();
        Pageable pageable = PageRequest.of(0, 10);

        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID())
                .title("Hóa đơn 1")
                .totalAmount(100000L)
                .payer(payer)
                .group(group)
                .createdAt(LocalDateTime.now())
                .build();

        TransactionSharingMember tsm = TransactionSharingMember.builder()
                .id(UUID.randomUUID())
                .transaction(tx)
                .user(payer)
                .shareAmount(100000L)
                .isPaid(true)
                .build();

        Page<Transaction> page = new PageImpl<>(List.of(tx), pageable, 1);

        when(groupMemberRepository.existsByGroupIdAndUserId(groupId, payer.getId())).thenReturn(true);
        when(transactionRepository.findGroupTransactionsForUser(eq(groupId), eq(payer.getId()), any(), any(), eq(pageable)))
                .thenReturn(page);
        when(sharingMemberRepository.findByTransactionIdIn(any())).thenReturn(List.of(tsm));

        PageResponse<TransactionDetailResponse> result = transactionService.getGroupTransactions(
                groupId, null, null, pageable, payerUserDetails
        );

        assertNotNull(result);
        assertEquals(1, result.getContent().size());
        assertEquals(1, result.getTotalElements());
        assertEquals(0, result.getPage());
        assertEquals(10, result.getSize());
    }
}
