package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.repository.*;
import com.kai.billingsharing.security.CustomUserDetails;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false"
})
class MultilateralNettingJpaTest {
    @Autowired EntityManager em;
    @Autowired GroupRepository groups;
    @Autowired TransactionSharingMemberRepository shares;
    @Autowired TransactionRepository transactions;
    @Autowired PaymentRequestRepository requests;
    @Autowired PaymentInfoRepository paymentInfos;
    @Autowired StatementPeriodRepository periods;
    @Autowired GroupMemberRepository members;
    @Autowired UserRepository users;
    @Autowired TokenRepository tokens;

    @ParameterizedTest(name = "A pays first={0}, reverse debt={1}")
    @CsvSource({"true,0", "false,0", "true,51807", "false,51807"})
    void closesBothDirectionsAfterReload(boolean aPaysFirst, long reverseDebt) {
        EmailService email = mock(EmailService.class);
        when(email.getDashboardUrl()).thenReturn("https://test.example");
        EmailOutboxService outbox = mock(EmailOutboxService.class);
        PaymentRequestService payments = new PaymentRequestService(requests, paymentInfos,
                shares, transactions, members, users, outbox, email);
        ScheduledTaskService settlement = new ScheduledTaskService(groups, shares, requests,
                paymentInfos, periods, outbox, email, tokens, payments, Clock.systemUTC());

        User a = user("Thanh", -600000L);
        User b = user("Minh", -400000L);
        User c = user("Kai", 1000000L);
        UUID aId = a.getId(), bId = b.getId(), cId = c.getId();
        Group group = Group.builder().name("Netting test").createdBy(c).build();
        em.persist(group);
        UUID groupId = group.getId();
        UUID ab = invoice(group, b, a, 100000L + reverseDebt);
        UUID ac = invoice(group, c, a, 500000L);
        UUID bc = invoice(group, c, b, 500000L);
        // The three unpaid Minh -> Thanh rows from the screenshot.
        List<UUID> reverse = reverseDebt == 0 ? List.of() : List.of(
                invoice(group, a, b, 7000L), invoice(group, a, b, 6807L),
                invoice(group, a, b, 38000L));
        reload();

        settlement.processSummaryForGroup(groups.findById(groupId).orElseThrow(), LocalDateTime.now());
        reload();
        List<PaymentRequest> pending = requests.findByTransactionGroupIdAndStatusIn(
                groupId, List.of(PaymentRequestStatus.PENDING));
        assertEquals(2, pending.size());
        PaymentRequest prA = pending.stream().filter(p -> p.getDebtor().getId().equals(aId)).findFirst().orElseThrow();
        PaymentRequest prB = pending.stream().filter(p -> p.getDebtor().getId().equals(bId)).findFirst().orElseThrow();
        UUID prAId = prA.getId(), prBId = prB.getId();
        assertEquals(600000L, prA.getAmount());
        assertEquals(400000L, prB.getAmount());
        Set<UUID> attached = prA.getSharingMembers().stream().map(TransactionSharingMember::getId).collect(Collectors.toSet());
        assertTrue(attached.contains(ab));
        assertTrue(attached.containsAll(reverse), "Reverse-direction netted shares must survive DB reload");
        assertFalse(shares.findById(ab).orElseThrow().getIsPaid());

        UUID first = aPaysFirst ? prAId : prBId;
        UUID second = aPaysFirst ? prBId : prAId;
        complete(payments, first, cId);
        assertEquals(aPaysFirst, shares.findById(ab).orElseThrow().getIsPaid());
        for (UUID id : reverse) assertEquals(aPaysFirst, shares.findById(id).orElseThrow().getIsPaid());
        List<Transaction> interim = transactions.findByRelatedPaymentRequestId(second);
        assertEquals(1, interim.size());
        assertEquals(aPaysFirst ? bId : cId, interim.get(0).getPayer().getId());
        assertEquals(100000L, interim.get(0).getTotalAmount());
        assertEquals(aPaysFirst ? cId : bId,
                shares.findByTransactionId(interim.get(0).getId()).get(0).getUser().getId());

        complete(payments, second, cId);
        assertEquals(PaymentRequestStatus.COMPLETED, requests.findById(prAId).orElseThrow().getStatus());
        assertEquals(PaymentRequestStatus.COMPLETED, requests.findById(prBId).orElseThrow().getStatus());
        assertTrue(transactions.findByRelatedPaymentRequestId(second).isEmpty());
        for (UUID id : List.of(ab, ac, bc)) assertPaid(id);
        for (UUID id : reverse) assertPaid(id);
        for (UUID id : List.of(aId, bId, cId)) assertEquals(0L, users.findById(id).orElseThrow().getBalance());
        assertTrue(shares.findByTransactionGroupIdAndIsPaidFalse(groupId).isEmpty());

        GroupMemberRepository access = mock(GroupMemberRepository.class);
        when(access.existsByGroupIdAndUserId(eq(groupId), any(UUID.class))).thenReturn(true);
        TransactionService detail = new TransactionService(transactions, shares, groups, access, users);
        var allIds = new java.util.ArrayList<>(List.of(ab, ac, bc));
        allIds.addAll(reverse);
        for (UUID id : allIds) {
            TransactionSharingMember sm = shares.findById(id).orElseThrow();
            var response = detail.getTransactionDetail(sm.getTransaction().getId(),
                    new CustomUserDetails(users.findById(sm.getUser().getId()).orElseThrow()));
            assertTrue(response.getMyShare().getIsPaid());
            assertEquals("PAID", response.getStatus());
        }
    }

    private void complete(PaymentRequestService service, UUID id, UUID creditorId) {
        PaymentRequest pr = requests.findById(id).orElseThrow();
        pr.setStatus(PaymentRequestStatus.WAITING_APPROVE);
        reload();
        service.approvePayment(id, new CustomUserDetails(users.findById(creditorId).orElseThrow()));
        reload();
    }

    private void assertPaid(UUID id) {
        TransactionSharingMember sm = shares.findById(id).orElseThrow();
        assertTrue(sm.getIsPaid(), "Unpaid share: " + id);
        assertNotNull(sm.getPaidAt());
    }

    private void reload() { em.flush(); em.clear(); }

    private User user(String name, long balance) {
        User u = User.builder().fullName(name).email(name + "@test.example")
                .password("test").role(Role.USER).balance(balance).build();
        em.persist(u);
        return u;
    }

    private UUID invoice(Group group, User payer, User debtor, long amount) {
        Transaction t = Transaction.builder().title("Invoice").group(group).payer(payer).totalAmount(amount).build();
        em.persist(t);
        TransactionSharingMember sm = TransactionSharingMember.builder()
                .transaction(t).user(debtor).shareAmount(amount).isPaid(false).build();
        em.persist(sm);
        return sm.getId();
    }
}
