package com.kai.billingsharing.controller;

import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.dto.request.AdminTransactionUpdateRequest;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.service.AdminTransactionService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;

import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(showSql = false, properties = {
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Import({AdminTransactionController.class, AdminTransactionService.class,
        AdminTransactionControllerTest.MethodSecurity.class})
class AdminTransactionControllerTest {
    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurity {}

    @Autowired EntityManager em;
    @Autowired AdminTransactionController controller;

    @Test
    @WithMockUser(roles = "USER")
    void membersCannotReadSystemInvoicesOrGroupOptions() {
        assertThrows(AccessDeniedException.class, () -> controller.list(null, null, null, 0, 20));
        assertThrows(AccessDeniedException.class, () -> controller.groups());
        assertThrows(AccessDeniedException.class, () -> controller.update(UUID.randomUUID(), null));
        assertThrows(AccessDeniedException.class, () -> controller.delete(UUID.randomUUID(), false));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminSeesAllGroupsWithoutMembershipAndCanPaginate() {
        fixture("One", "Dinner", false);
        fixture("Two", "Shopping", true);
        em.flush(); em.clear();
        var page = controller.list(null, null, null, 0, 1);
        assertEquals(2, page.getTotalElements());
        assertEquals(2, page.getTotalPages());
        assertEquals(1, page.getContent().size());
        var next = controller.list(null, null, null, 1, 1);
        assertNotEquals(page.getContent().get(0).id(), next.getContent().get(0).id());
        assertEquals(2, controller.groups().size());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void filtersByWholeInvoiceStatusGroupAndSearch() {
        UUID first = fixture("One", "Dinner", false);
        fixture("Two", "Shopping", true);
        em.flush(); em.clear();
        var unpaid = controller.list(null, null, false, 0, 20);
        assertEquals(1, unpaid.getTotalElements());
        assertFalse(unpaid.getContent().get(0).isPaid());
        assertEquals(2, unpaid.getContent().get(0).sharingMembers().size());
        assertEquals(1, controller.list(null, null, true, 0, 20).getTotalElements());
        assertEquals(1, controller.list(first, "dinner", null, 0, 20).getTotalElements());
        assertEquals(0, controller.list(first, "shopping", null, 0, 20).getTotalElements());
        assertEquals(1, controller.list(null, "two", null, 0, 20).getTotalElements());
        assertEquals(0, controller.list(null, "%", null, 0, 20).getTotalElements());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsInvalidPagination() {
        assertThrows(com.kai.billingsharing.exception.AppException.class,
                () -> controller.list(null, null, null, -1, 20));
        assertThrows(com.kai.billingsharing.exception.AppException.class,
                () -> controller.list(null, null, null, 0, 101));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void changingStatusAutomaticallySettlesAndReopensDebt() {
        fixture("One", "Dinner", false);
        em.flush(); em.clear();
        var row = controller.list(null, null, null, 0, 20).getContent().get(0);
        var debtor = row.sharingMembers().stream().filter(s -> !s.getUserId().equals(row.payerId())).findFirst().orElseThrow();
        controller.update(row.id(), update(row, true));
        em.flush(); em.clear();
        assertTrue(controller.list(null, null, null, 0, 20).getContent().get(0).isPaid());
        assertEquals(0L, em.find(User.class, debtor.getUserId()).getBalance());
        assertEquals(0L, em.find(User.class, row.payerId()).getBalance());
        assertNotNull(em.find(TransactionSharingMember.class, debtor.getId()).getPaidAt());
        controller.update(row.id(), update(row, false));
        em.flush(); em.clear();
        assertEquals(-100L, em.find(User.class, debtor.getUserId()).getBalance());
        assertEquals(100L, em.find(User.class, row.payerId()).getBalance());
        assertNull(em.find(TransactionSharingMember.class, debtor.getId()).getPaidAt());
        assertEquals(-100L, em.createQuery("select m.balance from GroupMember m where m.user.id = :user", Long.class)
                .setParameter("user", debtor.getUserId()).getSingleResult());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void editingAmountsUpdatesOutstandingBalancesAndDeletionRemovesDebt() {
        fixture("One", "Dinner", false);
        em.flush(); em.clear();
        var row = controller.list(null, null, null, 0, 20).getContent().get(0);
        var items = row.sharingMembers().stream().map(s -> new AdminTransactionUpdateRequest.ShareUpdate(
                s.getId(), s.getUserId().equals(row.payerId()) ? 100L : 200L, s.getIsPaid())).toList();
        controller.update(row.id(), new AdminTransactionUpdateRequest("Edited", 300L, items));
        em.flush(); em.clear();
        assertEquals(200L, em.find(User.class, row.payerId()).getBalance());
        assertEquals("Edited", em.find(Transaction.class, row.id()).getTitle());
        controller.delete(row.id(), true);
        em.flush(); em.clear();
        assertNull(em.find(Transaction.class, row.id()));
        assertEquals(0L, em.find(User.class, row.payerId()).getBalance());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void deletionPreservesCompletedPaymentHistoryAndDetachesForeignKeys() {
        fixture("One", "Dinner", false);
        em.flush();
        Transaction tx = em.createQuery("select t from Transaction t", Transaction.class).getSingleResult();
        var items = em.createQuery("select s from TransactionSharingMember s where s.transaction.id = :id", TransactionSharingMember.class)
                .setParameter("id", tx.getId()).getResultList();
        PaymentRequest payment = PaymentRequest.builder().transaction(tx).group(tx.getGroup())
                .sharingMember(items.get(0)).sharingMembers(new java.util.ArrayList<>(items))
                .creditor(tx.getPayer()).debtor(items.get(1).getUser()).amount(100L)
                .status(PaymentRequestStatus.COMPLETED).breakdownJson("{\"formula\":\"historical\"}").build();
        em.persist(payment); em.flush(); em.clear();
        controller.delete(tx.getId(), false);
        em.flush(); em.clear();
        PaymentRequest preserved = em.find(PaymentRequest.class, payment.getId());
        assertEquals(PaymentRequestStatus.COMPLETED, preserved.getStatus());
        assertEquals("{\"formula\":\"historical\"}", preserved.getBreakdownJson());
        assertNull(preserved.getTransaction());
        assertNull(preserved.getSharingMember());
        assertTrue(preserved.getSharingMembers().isEmpty());
        assertNull(em.find(Transaction.class, tx.getId()));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void cannotChangeOrDeleteInvoiceWithPendingPayment() {
        fixture("One", "Dinner", false);
        em.flush();
        Transaction tx = em.createQuery("select t from Transaction t", Transaction.class).getSingleResult();
        var item = em.createQuery("select s from TransactionSharingMember s where s.transaction.id = :id and s.isPaid = false", TransactionSharingMember.class)
                .setParameter("id", tx.getId()).getSingleResult();
        em.persist(PaymentRequest.builder().group(tx.getGroup()).sharingMembers(new java.util.ArrayList<>(List.of(item)))
                .creditor(tx.getPayer()).debtor(item.getUser()).amount(100L).status(PaymentRequestStatus.PENDING).build());
        em.flush(); em.clear();
        var row = controller.list(null, null, null, 0, 20).getContent().get(0);
        assertThrows(AppException.class, () -> controller.update(row.id(), update(row, true)));
        // Each operation is a separate transaction in production; this test rolls back at the end.
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void cannotDeleteInvoiceWithWaitingPayment() {
        fixture("One", "Dinner", false);
        em.flush();
        Transaction tx = em.createQuery("select t from Transaction t", Transaction.class).getSingleResult();
        var item = em.createQuery("select s from TransactionSharingMember s where s.transaction.id = :id and s.isPaid = false", TransactionSharingMember.class)
                .setParameter("id", tx.getId()).getSingleResult();
        em.persist(PaymentRequest.builder().transaction(tx).sharingMember(item)
                .creditor(tx.getPayer()).debtor(item.getUser()).amount(100L).status(PaymentRequestStatus.WAITING_APPROVE).build());
        em.flush(); em.clear();
        assertThrows(AppException.class, () -> controller.delete(tx.getId(), true));
        assertNotNull(em.find(Transaction.class, tx.getId()));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsForeignSharesAndIncorrectTotals() {
        fixture("One", "Dinner", false);
        em.flush(); em.clear();
        var row = controller.list(null, null, null, 0, 20).getContent().get(0);
        assertThrows(AppException.class, () -> controller.update(row.id(), new AdminTransactionUpdateRequest(
                "Invalid", 200L, List.of(new AdminTransactionUpdateRequest.ShareUpdate(UUID.randomUUID(), 200L, true)))));
        assertEquals("Dinner", em.find(Transaction.class, row.id()).getTitle());
    }

    private AdminTransactionUpdateRequest update(com.kai.billingsharing.dto.response.AdminTransactionResponse row, boolean paid) {
        return new AdminTransactionUpdateRequest(row.title(), row.totalAmount(), row.sharingMembers().stream()
                .map(s -> new AdminTransactionUpdateRequest.ShareUpdate(s.getId(), s.getShareAmount(),
                        s.getUserId().equals(row.payerId()) || paid)).toList());
    }

    @ParameterizedTest
    @CsvSource({"false,false,150", "false,false,50", "false,true,150", "true,false,150",
            "true,true,150", "false,false,100", "true,true,100", "true,false,50"})
    @WithMockUser(roles = "ADMIN")
    void amountAndStatusRecalculateBothUserAndGroupMemberFromUnpaid(
            boolean oldPaid, boolean newPaid, long newAmount) {
        UUID groupId = fixture("One", "Dinner", oldPaid);
        em.createQuery("update User u set u.balance = 12345").executeUpdate();
        em.createQuery("update GroupMember m set m.balance = 98765").executeUpdate();
        em.flush(); em.clear();
        var row = controller.list(null, null, null, 0, 20).getContent().get(0);
        var debtor = row.sharingMembers().stream().filter(s -> !s.getUserId().equals(row.payerId())).findFirst().orElseThrow();
        var changes = row.sharingMembers().stream().map(s -> new AdminTransactionUpdateRequest.ShareUpdate(
                s.getId(), s.getUserId().equals(row.payerId()) ? 100L : newAmount,
                s.getUserId().equals(row.payerId()) || newPaid)).toList();
        var update = new AdminTransactionUpdateRequest("Changed", 100L + newAmount, changes);
        controller.update(row.id(), update);
        em.flush(); em.clear();
        // Repeating the same save must not apply the balance delta twice.
        controller.update(row.id(), update);
        em.flush(); em.clear();
        long outstanding = newPaid ? 0L : newAmount;
        assertEquals(-outstanding, em.find(User.class, debtor.getUserId()).getBalance());
        assertEquals(outstanding, em.find(User.class, row.payerId()).getBalance());
        for (var userId : List.of(debtor.getUserId(), row.payerId())) {
            long expected = userId.equals(row.payerId()) ? outstanding : -outstanding;
            assertEquals(expected, em.createQuery("select m.balance from GroupMember m where m.group.id = :group and m.user.id = :user", Long.class)
                    .setParameter("group", groupId).setParameter("user", userId).getSingleResult());
        }
        assertEquals(newPaid, em.find(TransactionSharingMember.class, debtor.getId()).getIsPaid());
        assertEquals(newAmount, em.find(TransactionSharingMember.class, debtor.getId()).getShareAmount());
    }

    @ParameterizedTest
    @CsvSource({"false,-20,-90", "true,130,60"})
    @WithMockUser(roles = "ADMIN")
    void recalculationIncludesAllGroupsReverseDebtsAndInterimAdjustments(
            boolean newPaid, long debtorTotal, long debtorInFirstGroup) {
        UUID firstGroupId = fixture("One", "Dinner", false);
        em.flush();
        Group first = em.find(Group.class, firstGroupId);
        User payer = first.getCreatedBy();
        User debtor = em.createQuery("select u from User u where u.email = 'One-debtor@test.example'", User.class).getSingleResult();
        Group second = Group.builder().name("Second").createdBy(payer).build();
        Group empty = Group.builder().name("Empty").createdBy(payer).build();
        em.persist(second); em.persist(empty);
        for (var group : List.of(second, empty)) for (var user : List.of(payer, debtor))
            em.persist(GroupMember.builder().group(group).user(user).balance(555L).build());
        ledger(first, debtor, payer, 40L, false, false);
        ledger(first, debtor, payer, 20L, false, true);
        ledger(second, debtor, payer, 70L, false, false);
        ledger(second, payer, debtor, 900L, true, false); // PAID must not count.
        ledger(second, payer, payer, 500L, false, false); // Own share must not count.
        em.flush();
        em.createQuery("update User u set u.balance = 12345").executeUpdate();
        em.createQuery("update GroupMember m set m.balance = 98765").executeUpdate();
        em.clear();
        var row = controller.list(firstGroupId, "Dinner", null, 0, 20).getContent().get(0);
        var items = row.sharingMembers().stream().map(s -> new AdminTransactionUpdateRequest.ShareUpdate(
                s.getId(), s.getUserId().equals(row.payerId()) ? 100L : 150L,
                s.getUserId().equals(row.payerId()) || newPaid)).toList();
        controller.update(row.id(), new AdminTransactionUpdateRequest("Dinner", 250L, items));
        em.flush(); em.clear();
        assertEquals(debtorTotal, em.find(User.class, debtor.getId()).getBalance());
        assertEquals(-debtorTotal, em.find(User.class, payer.getId()).getBalance());
        assertMemberBalance(firstGroupId, debtor.getId(), debtorInFirstGroup);
        assertMemberBalance(firstGroupId, payer.getId(), -debtorInFirstGroup);
        assertMemberBalance(second.getId(), debtor.getId(), 70L);
        assertMemberBalance(second.getId(), payer.getId(), -70L);
        assertMemberBalance(empty.getId(), debtor.getId(), 0L);
        assertMemberBalance(empty.getId(), payer.getId(), 0L);
    }

    private void assertMemberBalance(UUID groupId, UUID userId, long expected) {
        assertEquals(expected, em.createQuery("select m.balance from GroupMember m where m.group.id = :group and m.user.id = :user", Long.class)
                .setParameter("group", groupId).setParameter("user", userId).getSingleResult());
    }

    private void ledger(Group group, User payer, User debtor, long amount, boolean paid, boolean adjustment) {
        var tx = Transaction.builder().title("Other").totalAmount(amount).payer(payer).group(group).isAdjustment(adjustment).build();
        em.persist(tx);
        em.persist(TransactionSharingMember.builder().transaction(tx).user(debtor).shareAmount(amount).isPaid(paid).build());
    }

    private UUID fixture(String groupName, String title, boolean paid) {
        User payer = User.builder().email(groupName + "@test.example").password("test")
                .fullName("Payer " + groupName).role(Role.USER).build();
        User debtor = User.builder().email(groupName + "-debtor@test.example").password("test")
                .fullName("Debtor " + groupName).role(Role.USER).build();
        em.persist(payer); em.persist(debtor);
        Group group = Group.builder().name(groupName).createdBy(payer).build();
        em.persist(group);
        payer.setBalance(paid ? 0L : 100L);
        debtor.setBalance(paid ? 0L : -100L);
        em.persist(GroupMember.builder().group(group).user(payer).balance(payer.getBalance()).build());
        em.persist(GroupMember.builder().group(group).user(debtor).balance(debtor.getBalance()).build());
        Transaction tx = Transaction.builder().title(title).totalAmount(200L).payer(payer).group(group).build();
        em.persist(tx);
        em.persist(TransactionSharingMember.builder().transaction(tx).user(payer).shareAmount(100L).isPaid(true).build());
        em.persist(TransactionSharingMember.builder().transaction(tx).user(debtor).shareAmount(100L).isPaid(paid).build());
        return group.getId();
    }
}
