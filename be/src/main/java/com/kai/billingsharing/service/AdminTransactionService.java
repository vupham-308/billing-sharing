package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.response.*;
import com.kai.billingsharing.dto.request.AdminTransactionUpdateRequest;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.entity.*;
import com.kai.billingsharing.repository.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminTransactionService {
    private final TransactionRepository transactions;
    private final TransactionSharingMemberRepository shares;
    private final PaymentRequestRepository requests;
    private final GroupMemberRepository members;
    private final UserRepository users;

    @Transactional
    public void update(UUID id, AdminTransactionUpdateRequest request) {
        Transaction tx = find(id);
        var current = shares.findByTransactionId(id);
        var incoming = new HashMap<UUID, AdminTransactionUpdateRequest.ShareUpdate>();
        long sum = 0;
        for (var item : request.sharingMembers()) {
            if (incoming.put(item.id(), item) != null) bad("Phần chia bị trùng");
            try { sum = Math.addExact(sum, item.shareAmount()); }
            catch (ArithmeticException e) { bad("Tổng phần chia quá lớn"); }
        }
        if (sum != request.totalAmount()) bad("Tổng phần chia phải bằng tổng hóa đơn");
        if (!incoming.keySet().equals(current.stream().map(TransactionSharingMember::getId).collect(Collectors.toSet())))
            bad("Danh sách phần chia đã thay đổi. Hãy tải lại hóa đơn.");
        boolean amountsChanged = !tx.getTotalAmount().equals(request.totalAmount()) ||
                current.stream().anyMatch(s -> !s.getShareAmount().equals(incoming.get(s.getId()).shareAmount()));
        boolean statusChanged = current.stream().anyMatch(s -> !Objects.equals(s.getIsPaid(), incoming.get(s.getId()).isPaid()));
        var linked = links(tx);
        if (amountsChanged || statusChanged) requireFinished(linked);
        if (amountsChanged && (!linked.isEmpty() || Boolean.TRUE.equals(tx.getIsAdjustment())))
            throw new AppException("Không thể đổi số tiền hóa đơn đã có lịch sử thanh toán hoặc điều chỉnh cấn trừ", HttpStatus.CONFLICT);
        LocalDateTime now = LocalDateTime.now();
        for (var s : current) {
            var next = incoming.get(s.getId());
            if (s.getUser().getId().equals(tx.getPayer().getId()) && !next.isPaid()) bad("Phần của người ứng tiền phải là đã trả");
            if (!Objects.equals(s.getIsPaid(), next.isPaid())) s.setPaidAt(next.isPaid() ? now : null);
            s.setIsPaid(next.isPaid());
            s.setShareAmount(next.shareAmount());
        }
        tx.setTitle(request.title().trim());
        tx.setTotalAmount(request.totalAmount());
        shares.flush();
        recalculateBalances(affectedUsers(tx, current));
    }

    @Transactional
    public void delete(UUID id, boolean adjustBalances) {
        Transaction tx = find(id);
        var current = shares.findByTransactionId(id);
        var linked = links(tx);
        requireFinished(linked);
        Set<UUID> affected = affectedUsers(tx, current);
        // Keep completed payment records and their immutable statement breakdowns.
        for (var pr : linked) {
            if (pr.getGroup() == null) pr.setGroup(tx.getGroup());
            pr.getSharingMembers().removeIf(s -> s.getTransaction().getId().equals(id));
            if (pr.getSharingMember() != null && pr.getSharingMember().getTransaction().getId().equals(id)) pr.setSharingMember(null);
            if (pr.getTransaction() != null && pr.getTransaction().getId().equals(id)) pr.setTransaction(null);
        }
        requests.flush();
        shares.deleteAll(current);
        shares.flush();
        transactions.delete(tx);
        transactions.flush();
        if (adjustBalances) recalculateBalances(affected);
    }

    private Transaction find(UUID id) {
        return transactions.findById(id).orElseThrow(() -> new AppException("Hóa đơn không tồn tại", HttpStatus.NOT_FOUND));
    }

    private List<PaymentRequest> links(Transaction tx) {
        var linked = new ArrayList<>(requests.findLinkedToTransaction(tx.getId()));
        if (tx.getRelatedPaymentRequestId() != null)
            requests.findById(tx.getRelatedPaymentRequestId()).ifPresent(pr -> { if (!linked.contains(pr)) linked.add(pr); });
        return linked;
    }

    private void requireFinished(List<PaymentRequest> linked) {
        if (linked.stream().anyMatch(pr -> pr.getStatus() != PaymentRequestStatus.COMPLETED))
            throw new AppException("Hóa đơn đang thuộc yêu cầu thanh toán chưa hoàn tất; chưa thể đổi số tiền, trạng thái hoặc xóa", HttpStatus.CONFLICT);
    }

    private Set<UUID> affectedUsers(Transaction tx, List<TransactionSharingMember> current) {
        Set<UUID> ids = current.stream().map(s -> s.getUser().getId()).collect(Collectors.toSet());
        ids.add(tx.getPayer().getId());
        return ids;
    }

    private void recalculateBalances(Set<UUID> affected) {
        Map<UUID, Long> total = new HashMap<>();
        Map<UUID, Map<UUID, Long>> byGroup = new HashMap<>();
        // Read persisted UNPAID shares across every group, including temporary
        // netting adjustments. Payer's own shares are excluded by the query.
        for (var share : shares.findOutstandingForUsers(affected)) {
            UUID debtorId = share.getUser().getId();
            UUID payerId = share.getTransaction().getPayer().getId();
            UUID groupId = share.getTransaction().getGroup().getId();
            var group = byGroup.computeIfAbsent(groupId, key -> new HashMap<>());
            if (affected.contains(debtorId)) {
                total.merge(debtorId, -share.getShareAmount(), Math::addExact);
                group.merge(debtorId, -share.getShareAmount(), Math::addExact);
            }
            if (affected.contains(payerId)) {
                total.merge(payerId, share.getShareAmount(), Math::addExact);
                group.merge(payerId, share.getShareAmount(), Math::addExact);
            }
        }
        for (var user : users.findAllById(affected)) {
            user.setBalance(total.getOrDefault(user.getId(), 0L));
            for (var member : members.findByUserId(user.getId())) {
                member.setBalance(byGroup.getOrDefault(member.getGroup().getId(), Map.of())
                        .getOrDefault(user.getId(), 0L));
            }
        }
    }

    private void bad(String message) { throw new AppException(message, HttpStatus.BAD_REQUEST); }

    @Transactional(readOnly = true)
    public PageResponse<AdminTransactionResponse> list(UUID groupId, String search, Boolean paid, int page, int size) {
        Specification<Transaction> filter = (root, query, cb) -> {
            List<Predicate> conditions = new ArrayList<>();
            if (groupId != null) conditions.add(cb.equal(root.get("group").get("id"), groupId));
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                conditions.add(cb.or(cb.like(cb.lower(root.get("title")), pattern, '\\'),
                        cb.like(cb.lower(root.get("group").get("name")), pattern, '\\'),
                        cb.like(cb.lower(root.get("payer").get("fullName")), pattern, '\\')));
            }
            if (paid != null) {
                var unpaid = query.subquery(UUID.class);
                var share = unpaid.from(TransactionSharingMember.class);
                unpaid.select(share.get("id")).where(cb.equal(share.get("transaction"), root),
                        cb.or(cb.isFalse(share.get("isPaid")), cb.isNull(share.get("isPaid"))));
                conditions.add(paid ? cb.not(cb.exists(unpaid)) : cb.exists(unpaid));
            }
            return cb.and(conditions.toArray(new Predicate[0]));
        };
        var results = transactions.findAll(filter, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        if (results.isEmpty()) return PageResponse.of(results, List.of());
        var byTransaction = shares.findByTransactionIdIn(results.map(Transaction::getId).getContent()).stream()
                .collect(Collectors.groupingBy(s -> s.getTransaction().getId()));
        var content = results.stream().map(t -> {
            var items = byTransaction.getOrDefault(t.getId(), List.of()).stream()
                    .sorted(Comparator.comparing(s -> s.getUser().getFullName(), Comparator.nullsLast(String::compareTo)))
                    .map(s -> SharingMemberDetailResponse.builder().id(s.getId()).userId(s.getUser().getId())
                            .fullName(s.getUser().getFullName()).email(s.getUser().getEmail())
                            .shareAmount(s.getShareAmount()).isPaid(s.getIsPaid()).paidAt(s.getPaidAt()).build()).toList();
            return new AdminTransactionResponse(t.getId(), t.getTitle(), t.getTotalAmount(),
                    t.getGroup().getId(), t.getGroup().getName(), t.getPayer().getId(), t.getPayer().getFullName(),
                    items.stream().allMatch(s -> Boolean.TRUE.equals(s.getIsPaid())),
                    Boolean.TRUE.equals(t.getIsAdjustment()), t.getAdjustmentType(), t.getCreatedAt(), items);
        }).toList();
        return PageResponse.of(results, content);
    }
}
