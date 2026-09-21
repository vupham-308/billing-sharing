package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.response.PaymentRequestResponse;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.security.CustomUserDetails;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentRequestServiceTest {

    @Mock
    private PaymentRequestRepository paymentRequestRepository;

    @Mock
    private PaymentInfoRepository paymentInfoRepository;

    @Mock
    private TransactionSharingMemberRepository sharingMemberRepository;

    @Mock
    private GroupMemberRepository groupMemberRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private PaymentRequestService paymentRequestService;

    private User debtor;
    private User creditor;
    private Group group;
    private Transaction transaction;
    private TransactionSharingMember sharingMember;
    private PaymentRequest paymentRequest;
    private CustomUserDetails debtorUserDetails;
    private CustomUserDetails creditorUserDetails;

    @BeforeEach
    void setUp() {
        debtor = User.builder()
                .id(UUID.randomUUID())
                .email("debtor@example.com")
                .fullName("Debtor User")
                .role(Role.USER)
                .balance(-50000L)
                .build();
        debtorUserDetails = new CustomUserDetails(debtor);

        creditor = User.builder()
                .id(UUID.randomUUID())
                .email("creditor@example.com")
                .fullName("Creditor User")
                .role(Role.USER)
                .balance(50000L)
                .build();
        creditorUserDetails = new CustomUserDetails(creditor);

        group = Group.builder().id(UUID.randomUUID()).name("Group Test").build();

        transaction = Transaction.builder()
                .id(UUID.randomUUID())
                .title("Ăn trưa")
                .totalAmount(100000L)
                .payer(creditor)
                .group(group)
                .build();

        sharingMember = TransactionSharingMember.builder()
                .id(UUID.randomUUID())
                .transaction(transaction)
                .user(debtor)
                .shareAmount(50000L)
                .isPaid(false)
                .build();

        paymentRequest = PaymentRequest.builder()
                .id(UUID.randomUUID())
                .transaction(transaction)
                .sharingMember(sharingMember)
                .debtor(debtor)
                .creditor(creditor)
                .amount(50000L)
                .status(PaymentRequestStatus.PENDING)
                .note("Thanh toán tiền ăn trưa")
                .build();
    }

    @Test
    void testConfirmPayment_Success_MovesToWaitingApprove() {
        UUID reqId = paymentRequest.getId();
        when(paymentRequestRepository.findById(reqId)).thenReturn(Optional.of(paymentRequest));
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));

        PaymentRequestResponse response = paymentRequestService.confirmPayment(reqId, debtorUserDetails);

        assertNotNull(response);
        assertEquals(PaymentRequestStatus.WAITING_APPROVE, response.getStatus());
        assertNotNull(response.getDebtorConfirmedAt());
        assertEquals(PaymentRequestStatus.WAITING_APPROVE, paymentRequest.getStatus());
    }

    @Test
    void testApprovePayment_Success_CompletesAndClearsDebt() {
        UUID reqId = paymentRequest.getId();
        paymentRequest.setStatus(PaymentRequestStatus.WAITING_APPROVE);

        when(paymentRequestRepository.findById(reqId)).thenReturn(Optional.of(paymentRequest));
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(sharingMemberRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(groupMemberRepository.findByGroupIdAndUserId(any(), eq(debtor.getId()))).thenReturn(Optional.empty());
        when(groupMemberRepository.findByGroupIdAndUserId(any(), eq(creditor.getId()))).thenReturn(Optional.empty());

        PaymentRequestResponse response = paymentRequestService.approvePayment(reqId, creditorUserDetails);

        assertNotNull(response);
        assertEquals(PaymentRequestStatus.COMPLETED, response.getStatus());
        assertNotNull(response.getCompletedAt());

        // Sharing member is marked paid
        assertTrue(sharingMember.getIsPaid());
        assertNotNull(sharingMember.getPaidAt());

        // Balances update
        assertEquals(0L, debtor.getBalance(), "Debtor balance should be cleared to 0");
        assertEquals(0L, creditor.getBalance(), "Creditor balance should be reduced to 0");
    }

    @Test
    void testRejectPayment_Success_MovesBackToPending() {
        UUID reqId = paymentRequest.getId();
        paymentRequest.setStatus(PaymentRequestStatus.WAITING_APPROVE);

        when(paymentRequestRepository.findById(reqId)).thenReturn(Optional.of(paymentRequest));
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));

        PaymentRequestResponse response = paymentRequestService.rejectPayment(reqId, creditorUserDetails);

        assertNotNull(response);
        assertEquals(PaymentRequestStatus.PENDING, response.getStatus());
        assertNull(paymentRequest.getDebtorConfirmedAt());
    }

    @Test
    void testPaymentInfo_SePayVietQrUrlFormat() {
        PaymentInfo info = PaymentInfo.builder()
                .bankCode("MBBank")
                .accountNumber("0123456789")
                .accountHolderName("NGUYEN VAN A")
                .build();

        String qrUrl = info.buildQrUrl(50000L, "Thanh toan an trua");
        assertNotNull(qrUrl);
        assertTrue(qrUrl.startsWith("https://vietqr.app/img"));
        assertTrue(qrUrl.contains("acc=0123456789"));
        assertTrue(qrUrl.contains("bank=MBBank"));
        assertTrue(qrUrl.contains("amount=50000"));
        assertTrue(qrUrl.contains("template=compact"));
        assertTrue(qrUrl.contains("holder=NGUYEN+VAN+A"));
    }
}
