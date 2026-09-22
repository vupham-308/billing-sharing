package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.repository.TransactionSharingMemberRepository;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NewInvoiceDigestReaderTest {
    private final TransactionSharingMemberRepository repository = mock(TransactionSharingMemberRepository.class);
    private final NewInvoiceDigestReader reader = new NewInvoiceDigestReader(repository);
    private final LocalDate date = LocalDate.of(2026, 9, 21);

    @Test
    void noSharingMembersMeansNoEmailAndNoBalanceQuery() {
        when(repository.findNewInvoiceShares(date.atStartOfDay(), date.plusDays(1).atStartOfDay()))
                .thenReturn(List.of());
        assertTrue(reader.read(date).isEmpty());
        verify(repository, never()).findOutstandingForUsers(any());
    }

    @Test
    void groupsAcrossTransactionsAndCountsDistinctInvoicesWithSeparateDebtAndCredit() {
        User member = user("member");
        User payer = user("payer");
        User other = user("other");
        Transaction first = transaction(payer);
        Transaction second = transaction(member);
        var firstShare = share(member, first, 100L);
        var ownShare = share(member, second, 50L);
        ownShare.setIsPaid(true);
        when(repository.findNewInvoiceShares(date.atStartOfDay(), date.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(firstShare, firstShare, ownShare));
        // Old debts also count; paid own share does not appear in outstanding query.
        when(repository.findOutstandingForUsers(Set.of(member.getId())))
                .thenReturn(List.of(firstShare, share(member, transaction(payer), 200L), share(other, second, 700L)));

        var digests = reader.read(date);
        assertEquals(1, digests.size());
        var digest = digests.get(0);
        assertEquals(member.getId(), digest.userId());
        assertEquals(2, digest.invoiceCount());
        assertEquals(300, digest.totalDebt());
        assertEquals(700, digest.totalCredit());
        // Payer-only users without a sharing row are not notification recipients.
        assertTrue(digests.stream().noneMatch(d -> d.userId().equals(payer.getId())));
    }

    @Test
    void paidNewInvoiceStillTriggersNotificationWithZeroOutstanding() {
        User member = user("member");
        var paid = share(member, transaction(user("payer")), 10L);
        paid.setIsPaid(true);
        when(repository.findNewInvoiceShares(date.atStartOfDay(), date.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(paid));
        when(repository.findOutstandingForUsers(any())).thenReturn(List.of());
        var digest = reader.read(date).get(0);
        assertEquals(1, digest.invoiceCount());
        assertEquals(0, digest.totalDebt());
        assertEquals(0, digest.totalCredit());
    }

    private User user(String name) {
        return User.builder().id(UUID.randomUUID()).fullName(name).email(name + "@example.com").isActive(true).build();
    }
    private Transaction transaction(User payer) {
        return Transaction.builder().id(UUID.randomUUID()).payer(payer).build();
    }
    private TransactionSharingMember share(User member, Transaction transaction, long amount) {
        return TransactionSharingMember.builder().id(UUID.randomUUID()).user(member)
                .transaction(transaction).shareAmount(amount).isPaid(false).build();
    }
}
