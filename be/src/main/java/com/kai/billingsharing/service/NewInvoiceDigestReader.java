package com.kai.billingsharing.service;

import com.kai.billingsharing.entity.TransactionSharingMember;
import com.kai.billingsharing.repository.TransactionSharingMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class NewInvoiceDigestReader {
    private final TransactionSharingMemberRepository sharingRepository;

    public record Digest(UUID userId, String email, String name, LocalDate date,
                         int invoiceCount, long totalDebt, long totalCredit) {}

    @Transactional(readOnly = true)
    public List<Digest> read(LocalDate date) {
        // Half-open interval includes 23:59:59 and fractional seconds, excludes next midnight.
        var newShares = sharingRepository.findNewInvoiceShares(date.atStartOfDay(), date.plusDays(1).atStartOfDay());
        Map<UUID, List<TransactionSharingMember>> byUser = new LinkedHashMap<>();
        for (var share : newShares) {
            byUser.computeIfAbsent(share.getUser().getId(), id -> new ArrayList<>()).add(share);
        }
        if (byUser.isEmpty()) return List.of();

        Map<UUID, Long> debts = new HashMap<>();
        Map<UUID, Long> credits = new HashMap<>();
        // Include all outstanding shares, even before a scheduled PaymentRequest exists.
        // WAITING_APPROVE remains outstanding until the creditor approves it.
        for (var share : sharingRepository.findOutstandingForUsers(byUser.keySet())) {
            debts.merge(share.getUser().getId(), share.getShareAmount(), Long::sum);
            credits.merge(share.getTransaction().getPayer().getId(), share.getShareAmount(), Long::sum);
        }
        List<Digest> result = new ArrayList<>();
        byUser.forEach((id, shares) -> {
            var user = shares.get(0).getUser();
            int count = (int) shares.stream().map(s -> s.getTransaction().getId()).distinct().count();
            result.add(new Digest(id, user.getEmail(), user.getFullName(), date, count,
                    debts.getOrDefault(id, 0L), credits.getOrDefault(id, 0L)));
        });
        return result;
    }
}
