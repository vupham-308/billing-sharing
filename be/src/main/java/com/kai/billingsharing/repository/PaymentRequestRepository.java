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

    List<PaymentRequest> findByTransactionGroupIdAndStatusIn(UUID groupId, java.util.Collection<PaymentRequestStatus> statuses);

    Optional<PaymentRequest> findByIdentify(String identify);

    boolean existsByIdentify(String identify);
}
