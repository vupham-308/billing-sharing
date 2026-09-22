package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.PaymentRequest;
import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRequestRepository extends JpaRepository<PaymentRequest, UUID> {

    List<PaymentRequest> findByDebtorIdOrderByCreatedAtDesc(UUID debtorId);

    List<PaymentRequest> findByCreditorIdOrderByCreatedAtDesc(UUID creditorId);

    List<PaymentRequest> findByDebtorIdAndStatusOrderByCreatedAtDesc(UUID debtorId, PaymentRequestStatus status);

    List<PaymentRequest> findByCreditorIdAndStatusOrderByCreatedAtDesc(UUID creditorId, PaymentRequestStatus status);

    List<PaymentRequest> findByStatus(PaymentRequestStatus status);

    boolean existsBySharingMemberId(UUID sharingMemberId);

    Optional<PaymentRequest> findBySharingMemberId(UUID sharingMemberId);

    @org.springframework.data.jpa.repository.Query("SELECT pr FROM PaymentRequest pr WHERE (pr.group.id = :groupId OR (pr.transaction IS NOT NULL AND pr.transaction.group.id = :groupId)) AND pr.status IN :statuses ORDER BY pr.createdAt DESC")
    List<PaymentRequest> findActiveRequestsByGroupId(@org.springframework.data.repository.query.Param("groupId") UUID groupId, @org.springframework.data.repository.query.Param("statuses") java.util.Collection<PaymentRequestStatus> statuses);

    default List<PaymentRequest> findByTransactionGroupIdAndStatusIn(UUID groupId, java.util.Collection<PaymentRequestStatus> statuses) {
        return findActiveRequestsByGroupId(groupId, statuses);
    }

    @org.springframework.data.jpa.repository.Query("SELECT CASE WHEN COUNT(pr) > 0 THEN true ELSE false END FROM PaymentRequest pr LEFT JOIN pr.sharingMembers sm WHERE (pr.sharingMember.id = :sharingMemberId OR sm.id = :sharingMemberId) AND pr.status IN :statuses")
    boolean existsBySharingMemberIdAndStatusIn(@org.springframework.data.repository.query.Param("sharingMemberId") UUID sharingMemberId, @org.springframework.data.repository.query.Param("statuses") java.util.Collection<PaymentRequestStatus> statuses);

    Optional<PaymentRequest> findByIdentify(String identify);

    boolean existsByIdentify(String identify);
}
