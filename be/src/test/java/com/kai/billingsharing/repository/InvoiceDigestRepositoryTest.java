package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.Role;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=false"
})
class InvoiceDigestRepositoryTest {
    @Autowired EntityManager em;
    @Autowired TransactionSharingMemberRepository shares;
    @Autowired EmailOutboxRepository emailOutboxRepository;

    @Test
    void selectsWholePreviousDayActiveSharingMembersIncludingPaidButNotNextMidnight() {
        User payer = user("payer", true);
        User member = user("member", true);
        User inactive = user("inactive", false);
        Group group = Group.builder().name("group").createdBy(payer).build();
        em.persist(group);
        LocalDateTime start = LocalDate.of(2026, 9, 21).atStartOfDay();
        invoice(group, payer, member, start.minusSeconds(1), false);
        var atStart = invoice(group, payer, member, start, false);
        var atEnd = invoice(group, payer, member, start.plusDays(1).minusNanos(1000), true);
        invoice(group, payer, member, start.plusDays(1), false);
        invoice(group, payer, inactive, start.plusHours(12), false);
        em.flush();
        em.clear();
        var found = shares.findNewInvoiceShares(start, start.plusDays(1));
        assertEquals(Set.of(atStart, atEnd), new HashSet<>(found.stream().map(TransactionSharingMember::getId).toList()));
        assertTrue(found.stream().allMatch(s -> s.getUser().getId().equals(member.getId())));
    }

    @Test
    void payerWithOwnSharingRowDoesNotReceiveNewInvoiceNotification() {
        User payer = user("payer", true);
        Group group = Group.builder().name("group").createdBy(payer).build();
        em.persist(group);
        LocalDate day = LocalDate.of(2026, 9, 21);
        invoice(group, payer, payer, day.atTime(12, 0), true);
        em.flush();
        em.clear();

        var digests = new com.kai.billingsharing.service.NewInvoiceDigestReader(shares).read(day);
        assertTrue(digests.isEmpty());
    }

    @Test
    void mixedRolesReceiveOnlyOtherPayersInvoicesAndRetainBothOutstandingTotals() {
        User member = user("member", true);
        User other = user("other", true);
        Group group = Group.builder().name("group").createdBy(member).build();
        em.persist(group);
        LocalDate day = LocalDate.of(2026, 9, 21);
        invoice(group, member, member, day.atTime(10, 0), true);
        invoice(group, other, member, day.atTime(12, 0), false);
        invoice(group, member, other, day.atTime(14, 0), false);
        em.flush();
        em.clear();

        var digest = new com.kai.billingsharing.service.NewInvoiceDigestReader(shares).read(day).stream()
                .filter(d -> d.userId().equals(member.getId())).findFirst().orElseThrow();
        assertEquals(1, digest.invoiceCount());
        assertEquals(100, digest.totalDebt());
        assertEquals(100, digest.totalCredit());
    }

    @Test
    void outstandingIncludesOldDebtsAndCreditsButExcludesPaidAndSelfShares() {
        User member = user("member", true);
        User other = user("other", true);
        Group group = Group.builder().name("group").createdBy(other).build();
        em.persist(group);
        var day = LocalDate.of(2026, 1, 1).atStartOfDay();
        UUID debt = invoice(group, other, member, day, false);
        UUID credit = invoice(group, member, other, day, false);
        invoice(group, other, member, day, true);
        invoice(group, member, member, day, false);
        em.flush();
        em.clear();
        var found = shares.findOutstandingForUsers(Set.of(member.getId()));
        assertEquals(Set.of(debt, credit), new HashSet<>(found.stream().map(TransactionSharingMember::getId).toList()));
    }

    @Test
    void databaseRejectsDuplicateRecipientAndDayClaim() {
        UUID userId = UUID.randomUUID();
        emailOutboxRepository.saveAndFlush(outbox(userId));
        assertThrows(DataIntegrityViolationException.class, () -> emailOutboxRepository.saveAndFlush(outbox(userId)));
    }

    private EmailOutbox outbox(UUID userId) {
        return EmailOutbox.builder()
                .type(com.kai.billingsharing.entity.enums.EmailType.INVOICE_DIGEST)
                .recipientEmail("user@example.com")
                .subject("Test")
                .htmlContent("<p>Test</p>")
                .businessKey("INVOICE_DIGEST:" + userId + ":2026-09-21")
                .businessDate(LocalDate.of(2026, 9, 21))
                .status(com.kai.billingsharing.entity.enums.OutboxStatus.PENDING)
                .build();
    }

    private User user(String name, boolean active) {
        var user = User.builder().email(name + "@example.com").password("encoded").role(Role.USER)
                .fullName(name).isActive(active).build();
        em.persist(user);
        return user;
    }

    private UUID invoice(Group group, User payer, User member, LocalDateTime createdAt, boolean paid) {
        var transaction = Transaction.builder().title("invoice").totalAmount(100L).group(group).payer(payer).build();
        em.persist(transaction);
        var share = TransactionSharingMember.builder().transaction(transaction).user(member).shareAmount(100L).isPaid(paid).build();
        em.persist(share);
        em.flush();
        // CreationTimestamp is generated at insert; set a historical timestamp for boundary testing.
        em.createNativeQuery("UPDATE transactions SET created_at = :created WHERE id = :id")
                .setParameter("created", createdAt).setParameter("id", transaction.getId()).executeUpdate();
        return share.getId();
    }
}
