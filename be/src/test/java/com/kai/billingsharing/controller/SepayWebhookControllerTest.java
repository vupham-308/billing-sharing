package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.webhook.SepayWebhookPayload;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.service.EmailOutboxService;
import com.kai.billingsharing.service.EmailService;
import com.kai.billingsharing.service.PaymentRequestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SepayWebhookControllerTest {

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

    @Mock
    private EmailOutboxService emailOutboxService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private PaymentRequestService paymentRequestService;

    private SepayWebhookController controller;

    private User debtor;
    private User creditor;
    private PaymentInfo creditorPaymentInfo;
    private PaymentRequest paymentRequest;
    private TransactionSharingMember sharingMember;

    @BeforeEach
    void setUp() {
        controller = new SepayWebhookController(paymentRequestService);

        debtor = User.builder()
                .id(UUID.randomUUID())
                .email("debtor@example.com")
                .fullName("Pham Tuan Vu")
                .role(Role.USER)
                .balance(-100000L)
                .build();

        creditor = User.builder()
                .id(UUID.randomUUID())
                .email("creditor@example.com")
                .fullName("Nguyen Van A")
                .role(Role.USER)
                .balance(100000L)
                .build();

        creditorPaymentInfo = PaymentInfo.builder()
                .id(UUID.randomUUID())
                .user(creditor)
                .bankCode("MBBank")
                .accountNumber("0123456789")
                .accountHolderName("NGUYEN VAN A")
                .sepayApiKey("sepay_secret_key_123")
                .build();

        Group group = Group.builder().id(UUID.randomUUID()).name("Test Group").build();
        Transaction transaction = Transaction.builder()
                .id(UUID.randomUUID())
                .title("Tien nha")
                .group(group)
                .payer(creditor)
                .totalAmount(100000L)
                .build();

        sharingMember = TransactionSharingMember.builder()
                .id(UUID.randomUUID())
                .transaction(transaction)
                .user(debtor)
                .shareAmount(100000L)
                .isPaid(false)
                .build();

        paymentRequest = PaymentRequest.builder()
                .id(UUID.randomUUID())
                .transaction(transaction)
                .sharingMember(sharingMember)
                .debtor(debtor)
                .creditor(creditor)
                .amount(100000L)
                .status(PaymentRequestStatus.PENDING)
                .identify("SHARE48291")
                .note("SHARE48291 PHAM TUAN VU chuyen tien")
                .build();

        lenient().when(emailService.buildPaymentNotificationHtml(any(), any(), any(), anyLong(), any(), any(), any()))
                .thenReturn("<html>Notification</html>");
    }

    @Test
    void testHandleSepayWebhook_Success_AutoApproves() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1001L)
                .gateway("MBBank")
                .accountNumber("0123456789")
                .code("SHARE48291")
                .content("SHARE48291 PHAM TUAN VU chuyen tien")
                .transferType("in")
                .transferAmount(100000L)
                .build();

        when(paymentRequestRepository.findByIdentify("SHARE48291")).thenReturn(Optional.of(paymentRequest));
        when(paymentInfoRepository.findByUserId(creditor.getId())).thenReturn(Optional.of(creditorPaymentInfo));
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(sharingMemberRepository.save(any(TransactionSharingMember.class))).thenAnswer(i -> i.getArgument(0));
        when(groupMemberRepository.findByGroupIdAndUserId(any(), any())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(
                payload,
                "Apikey sepay_secret_key_123",
                null
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals(PaymentRequestStatus.COMPLETED, paymentRequest.getStatus());
        assertTrue(sharingMember.getIsPaid());
        assertEquals(0L, debtor.getBalance());
        assertEquals(0L, creditor.getBalance());

        // Verify email outbox was recorded for PAYMENT_APPROVED
        verify(emailOutboxService, times(1)).recordOutbox(
                eq(EmailType.PAYMENT_APPROVED),
                eq("debtor@example.com"),
                eq("Pham Tuan Vu"),
                anyString(),
                anyString(),
                isNull(),
                anyString(),
                any(LocalDate.class)
        );
    }

    @Test
    void testHandleSepayWebhook_ExtractIdentifyFromContent() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1002L)
                .gateway("MBBank")
                .accountNumber("0123456789")
                .content("Giao dich SHARE48291 PHAM TUAN VU chuyen tien")
                .transferType("in")
                .transferAmount(100000L)
                .build();

        when(paymentRequestRepository.findByIdentify("SHARE48291")).thenReturn(Optional.of(paymentRequest));
        when(paymentInfoRepository.findByUserId(creditor.getId())).thenReturn(Optional.of(creditorPaymentInfo));
        when(paymentRequestRepository.save(any(PaymentRequest.class))).thenAnswer(i -> i.getArgument(0));
        when(sharingMemberRepository.save(any(TransactionSharingMember.class))).thenAnswer(i -> i.getArgument(0));
        when(groupMemberRepository.findByGroupIdAndUserId(any(), any())).thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(
                payload,
                "Bearer sepay_secret_key_123",
                null
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        assertEquals(PaymentRequestStatus.COMPLETED, paymentRequest.getStatus());
    }

    @Test
    void testHandleSepayWebhook_Idempotency_AlreadyCompleted() {
        paymentRequest.setStatus(PaymentRequestStatus.COMPLETED);

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1003L)
                .code("SHARE48291")
                .transferType("in")
                .transferAmount(100000L)
                .build();

        when(paymentRequestRepository.findByIdentify("SHARE48291")).thenReturn(Optional.of(paymentRequest));

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(payload, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        verify(paymentRequestRepository, never()).save(any());
    }

    @Test
    void testHandleSepayWebhook_InvalidApiKey_ReturnsUnauthorized() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1004L)
                .code("SHARE48291")
                .transferType("in")
                .transferAmount(100000L)
                .build();

        when(paymentRequestRepository.findByIdentify("SHARE48291")).thenReturn(Optional.of(paymentRequest));
        when(paymentInfoRepository.findByUserId(creditor.getId())).thenReturn(Optional.of(creditorPaymentInfo));

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(
                payload,
                "Apikey WRONG_KEY",
                null
        );

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals(PaymentRequestStatus.PENDING, paymentRequest.getStatus());
    }

    @Test
    void testHandleSepayWebhook_CreditorNoApiKey_DoesNotAutoApprove() {
        creditorPaymentInfo.setSepayApiKey(null); // No API key set

        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1005L)
                .code("SHARE48291")
                .transferType("in")
                .transferAmount(100000L)
                .build();

        when(paymentRequestRepository.findByIdentify("SHARE48291")).thenReturn(Optional.of(paymentRequest));
        when(paymentInfoRepository.findByUserId(creditor.getId())).thenReturn(Optional.of(creditorPaymentInfo));

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(payload, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertFalse((Boolean) response.getBody().get("success"));
        assertEquals(PaymentRequestStatus.PENDING, paymentRequest.getStatus());
    }

    @Test
    void testHandleSepayWebhook_TransferTypeOut_Ignored() {
        SepayWebhookPayload payload = SepayWebhookPayload.builder()
                .id(1006L)
                .code("SHARE48291")
                .transferType("out")
                .transferAmount(100000L)
                .build();

        ResponseEntity<Map<String, Object>> response = controller.handleSepayWebhook(payload, null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue((Boolean) response.getBody().get("success"));
        verify(paymentRequestRepository, never()).findByIdentify(any());
    }
}
