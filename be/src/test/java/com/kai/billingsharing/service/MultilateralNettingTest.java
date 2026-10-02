package com.kai.billingsharing.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kai.billingsharing.dto.response.PaymentRequestBreakdownResponse;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MultilateralNettingTest {

    @Mock
    private GroupRepository groupRepository;
    @Mock
    private TransactionSharingMemberRepository sharingMemberRepository;
    @Mock
    private TransactionRepository transactionRepository;
    @Mock
    private PaymentRequestRepository paymentRequestRepository;
    @Mock
    private PaymentInfoRepository paymentInfoRepository;
    @Mock
    private StatementPeriodRepository statementPeriodRepository;
    @Mock
    private EmailOutboxService emailOutboxService;
    @Mock
    private EmailService emailService;
    @Mock
    private TokenRepository tokenRepository;
    @Mock
    private PaymentRequestService mockPaymentRequestService;
    @Mock
    private GroupMemberRepository groupMemberRepository;
    @Mock
    private UserRepository userRepository;

    private ScheduledTaskService scheduledTaskService;
    private PaymentRequestService realPaymentRequestService;

    private User userA;
    private User userB;
    private User userC;
    private Group group;
    private ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        userA = User.builder().id(UUID.randomUUID()).email("a@test.com").fullName("User A").role(Role.USER).balance(-110_000L).build();
        userB = User.builder().id(UUID.randomUUID()).email("b@test.com").fullName("User B").role(Role.USER).balance(-40_000L).build();
        userC = User.builder().id(UUID.randomUUID()).email("c@test.com").fullName("User C").role(Role.USER).balance(150_000L).build();

        group = Group.builder().id(UUID.randomUUID()).name("Nhóm Test").createdAt(LocalDateTime.now().minusDays(30)).build();

        realPaymentRequestService = new PaymentRequestService(
                paymentRequestRepository,
                paymentInfoRepository,
                sharingMemberRepository,
                transactionRepository,
                groupMemberRepository,
                userRepository,
                emailOutboxService,
                emailService
        );

        scheduledTaskService = new ScheduledTaskService(
                groupRepository,
                sharingMemberRepository,
                paymentRequestRepository,
                paymentInfoRepository,
                statementPeriodRepository,
                emailOutboxService,
                emailService,
                tokenRepository,
                realPaymentRequestService,
                Clock.systemDefaultZone()
        );
    }

    @Test
    @DisplayName("Cấn trừ đa phương: A nợ C 100k, B nợ C 50k, A nợ B 10k -> A nợ C 110k, B nợ C 40k")
    void testMultilateralNettingCalculation() throws Exception {
        // Giao dịch 1: C chi cho A (100k)
        Transaction tx1 = Transaction.builder().id(UUID.randomUUID()).title("C chi tiền A").payer(userC).group(group).totalAmount(100_000L).build();
        TransactionSharingMember share1 = TransactionSharingMember.builder().id(UUID.randomUUID()).transaction(tx1).user(userA).shareAmount(100_000L).isPaid(false).build();

        // Giao dịch 2: C chi cho B (50k)
        Transaction tx2 = Transaction.builder().id(UUID.randomUUID()).title("C chi tiền B").payer(userC).group(group).totalAmount(50_000L).build();
        TransactionSharingMember share2 = TransactionSharingMember.builder().id(UUID.randomUUID()).transaction(tx2).user(userB).shareAmount(50_000L).isPaid(false).build();

        // Giao dịch 3: B chi cho A (10k)
        Transaction tx3 = Transaction.builder().id(UUID.randomUUID()).title("B chi tiền A").payer(userB).group(group).totalAmount(10_000L).build();
        TransactionSharingMember share3 = TransactionSharingMember.builder().id(UUID.randomUUID()).transaction(tx3).user(userA).shareAmount(10_000L).isPaid(false).build();

        when(sharingMemberRepository.findByTransactionGroupIdAndIsPaidFalse(group.getId()))
                .thenReturn(List.of(share1, share2, share3));
        when(statementPeriodRepository.findTopByGroupIdOrderByEndDateDesc(group.getId()))
                .thenReturn(Optional.empty());

        Map<UUID, PaymentRequest> savedMap = new LinkedHashMap<>();
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(invocation -> {
            PaymentRequest pr = invocation.getArgument(0);
            if (pr.getId() == null) {
                pr.setId(UUID.randomUUID());
            }
            savedMap.put(pr.getId(), pr);
            return pr;
        });
        when(paymentRequestRepository.findByTransactionGroupIdAndStatusIn(eq(group.getId()), anyList()))
                .thenAnswer(invocation -> new ArrayList<>(savedMap.values()));
        lenient().when(emailService.getDashboardUrl()).thenReturn("https://test.com");

        // Chạy tất toán
        scheduledTaskService.processSummaryForGroup(group, LocalDateTime.now());

        // Kiểm tra: Phải tạo chính xác 2 PaymentRequest (A->C và B->C), không tạo A->B!
        assertEquals(2, savedMap.size());

        List<PaymentRequest> savedRequests = new ArrayList<>(savedMap.values());
        PaymentRequest prA = savedRequests.stream().filter(pr -> pr.getDebtor().getId().equals(userA.getId())).findFirst().orElseThrow();
        PaymentRequest prB = savedRequests.stream().filter(pr -> pr.getDebtor().getId().equals(userB.getId())).findFirst().orElseThrow();

        // Kiểm tra PR của A: nợ C 110k
        assertEquals(userC.getId(), prA.getCreditor().getId());
        assertEquals(110_000L, prA.getAmount());
        PaymentRequestBreakdownResponse brA = realPaymentRequestService.parseBreakdownJson(prA.getBreakdownJson());
        assertNotNull(brA);
        assertEquals(10_000L, brA.getTransferredDebtAmount());
        assertEquals(userB.getId(), brA.getTransferredDebtorId());
        assertNull(brA.getNettingDetailNote());
        assertTrue(brA.getFormula().contains("100.000") && brA.getFormula().contains("10.000") && brA.getFormula().contains("110.000"));

        // Kiểm tra PR của B: nợ C 40k
        assertEquals(userC.getId(), prB.getCreditor().getId());
        assertEquals(40_000L, prB.getAmount());
        PaymentRequestBreakdownResponse brB = realPaymentRequestService.parseBreakdownJson(prB.getBreakdownJson());
        assertNotNull(brB);
        assertEquals(10_000L, brB.getOffsetCreditAmount());
        assertEquals(userA.getId(), brB.getTransferredDebtorId());
        assertEquals("Đã cấn trừ khoản nợ của " + userA.getFullName() + ": -10.000đ", brB.getNettingDetailNote());
        assertTrue(brB.getFormula().contains("50.000") && brB.getFormula().contains("10.000") && brB.getFormula().contains("40.000"));

        // Kiểm tra gửi Email Outbox: Có cả người nợ (A, B) và người nhận (C)
        ArgumentCaptor<String> businessKeyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> recipientEmailCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailOutboxService, times(3)).recordOutbox(
                eq(EmailType.STATEMENT),
                recipientEmailCaptor.capture(),
                any(),
                any(),
                any(),
                any(),
                businessKeyCaptor.capture(),
                any()
        );

        List<String> emails = recipientEmailCaptor.getAllValues();
        assertTrue(emails.contains(userA.getEmail()));
        assertTrue(emails.contains(userB.getEmail()));
        assertTrue(emails.contains(userC.getEmail()));

        List<String> bKeys = businessKeyCaptor.getAllValues();
        assertTrue(bKeys.contains("STATEMENT:" + group.getId() + ":" + userA.getId() + ":1"));
        assertTrue(bKeys.contains("STATEMENT:" + group.getId() + ":" + userB.getId() + ":1"));
        assertTrue(bKeys.contains("STATEMENT_CREDIT:" + group.getId() + ":" + userC.getId() + ":1"));
    }

    @Test
    @DisplayName("Kịch bản 1: A chuyển cho C trước -> Hóa đơn A nợ B về PAID, tạo giao dịch B->C 10k; sau đó B chuyển -> xóa giao dịch trung gian")
    void testCase1_APaysFirst_ThenBPays() {
        UUID shareABId = UUID.randomUUID();
        TransactionSharingMember shareAB = TransactionSharingMember.builder().id(shareABId).isPaid(false).build();
        when(sharingMemberRepository.findById(shareABId)).thenReturn(Optional.of(shareAB));

        UUID prBId = UUID.randomUUID();
        PaymentRequest prB = PaymentRequest.builder()
                .id(prBId)
                .debtor(userB)
                .creditor(userC)
                .amount(40_000L)
                .status(PaymentRequestStatus.PENDING)
                .build();
        when(paymentRequestRepository.findById(prBId)).thenReturn(Optional.of(prB));

        PaymentRequest prA = PaymentRequest.builder()
                .id(UUID.randomUUID())
                .debtor(userA)
                .creditor(userC)
                .amount(110_000L)
                .status(PaymentRequestStatus.WAITING_APPROVE)
                .group(group)
                .breakdownJson(String.format("{\"transferredDebtAmount\":10000,\"transferredDebtorId\":\"%s\",\"linkedPaymentRequestId\":\"%s\",\"transferredShareIds\":[\"%s\"]}",
                        userB.getId(), prBId, shareABId))
                .build();

        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(userRepository.findById(userB.getId())).thenReturn(Optional.of(userB));

        Transaction interimTx = Transaction.builder().id(UUID.randomUUID()).title("Interim Tx").relatedPaymentRequestId(prBId).build();
        when(transactionRepository.save(any(Transaction.class))).thenReturn(interimTx);

        // 1. A chuyển khoản thành công cho C
        realPaymentRequestService.completePaymentInternal(prA, "MANUAL");

        // Kiểm tra hóa đơn A nợ B đã về PAID
        assertTrue(shareAB.getIsPaid());

        // Kiểm tra đã tạo giao dịch trung gian Payer B -> Debtor C (10k)
        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        Transaction savedInterim = txCaptor.getValue();
        assertEquals(userB, savedInterim.getPayer());
        assertEquals(10_000L, savedInterim.getTotalAmount());
        assertEquals("NETTING_INTERIM_B_TO_C", savedInterim.getAdjustmentType());
        assertEquals(prBId, savedInterim.getRelatedPaymentRequestId());

        // 2. Sau đó B chuyển khoản thành công cho C (40k)
        when(transactionRepository.findByRelatedPaymentRequestId(prBId)).thenReturn(List.of(interimTx));
        realPaymentRequestService.completePaymentInternal(prB, "MANUAL");

        // Kiểm tra giao dịch trung gian đã được tự động xóa
        verify(sharingMemberRepository).deleteByTransactionId(interimTx.getId());
        verify(transactionRepository).delete(interimTx);
    }

    @Test
    @DisplayName("Kịch bản 2: B chuyển cho C trước -> Hóa đơn A nợ B vẫn UNPAID, tạo giao dịch B->A 10k; sau đó A chuyển -> xóa giao dịch trung gian")
    void testCase2_BPaysFirst_ThenAPays() {
        UUID shareABId = UUID.randomUUID();
        TransactionSharingMember shareAB = TransactionSharingMember.builder().id(shareABId).isPaid(false).build();

        UUID prAId = UUID.randomUUID();
        PaymentRequest prA = PaymentRequest.builder()
                .id(prAId)
                .debtor(userA)
                .creditor(userC)
                .amount(110_000L)
                .status(PaymentRequestStatus.PENDING)
                .group(group)
                .breakdownJson(String.format("{\"transferredDebtAmount\":10000,\"transferredDebtorId\":\"%s\",\"transferredShareIds\":[\"%s\"]}",
                        userB.getId(), shareABId))
                .build();
        when(paymentRequestRepository.findById(prAId)).thenReturn(Optional.of(prA));

        PaymentRequest prB = PaymentRequest.builder()
                .id(UUID.randomUUID())
                .debtor(userB)
                .creditor(userC)
                .amount(40_000L)
                .status(PaymentRequestStatus.WAITING_APPROVE)
                .group(group)
                .breakdownJson(String.format("{\"offsetCreditAmount\":10000,\"transferredDebtorId\":\"%s\",\"linkedPaymentRequestId\":\"%s\"}",
                        userA.getId(), prAId))
                .build();

        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(userRepository.findById(userA.getId())).thenReturn(Optional.of(userA));

        Transaction interimTx = Transaction.builder().id(UUID.randomUUID()).title("Interim Tx").relatedPaymentRequestId(prAId).build();
        when(transactionRepository.save(any(Transaction.class))).thenReturn(interimTx);

        // 1. B chuyển khoản thành công cho C trước
        realPaymentRequestService.completePaymentInternal(prB, "MANUAL");

        // Hóa đơn của A vẫn là UNPAID
        assertFalse(shareAB.getIsPaid());

        // Kiểm tra đã tạo giao dịch trung gian Payer C (Vũ) -> Debtor B (Minh) (10k)
        ArgumentCaptor<Transaction> txCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(txCaptor.capture());
        Transaction savedInterim = txCaptor.getValue();
        assertEquals(userC, savedInterim.getPayer());
        assertEquals(10_000L, savedInterim.getTotalAmount());
        assertEquals("NETTING_INTERIM_C_TO_B", savedInterim.getAdjustmentType());
        assertTrue(savedInterim.getTitle().contains(userC.getFullName()));
        assertTrue(savedInterim.getTitle().contains(userA.getFullName()));
        assertEquals(prAId, savedInterim.getRelatedPaymentRequestId());

        ArgumentCaptor<TransactionSharingMember> smCaptor = ArgumentCaptor.forClass(TransactionSharingMember.class);
        verify(sharingMemberRepository).save(smCaptor.capture());
        assertEquals(userB, smCaptor.getValue().getUser());

        // 2. Sau đó A chuyển khoản thành công cho C (110k)
        when(sharingMemberRepository.findById(shareABId)).thenReturn(Optional.of(shareAB));
        when(transactionRepository.findByRelatedPaymentRequestId(prAId)).thenReturn(List.of(interimTx));

        realPaymentRequestService.completePaymentInternal(prA, "MANUAL");

        // Hóa đơn của A chuyển thành PAID
        assertTrue(shareAB.getIsPaid());

        // Giao dịch trung gian được tự động xóa
        verify(sharingMemberRepository).deleteByTransactionId(interimTx.getId());
        verify(transactionRepository).delete(interimTx);
    }
}
