package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.TransactionSharingMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionSharingMemberRepository extends JpaRepository<TransactionSharingMember, UUID> {

    List<TransactionSharingMember> findByTransactionId(UUID transactionId);

    List<TransactionSharingMember> findByTransactionIdIn(Collection<UUID> transactionIds);

    Optional<TransactionSharingMember> findByTransactionIdAndUserId(UUID transactionId, UUID userId);

    List<TransactionSharingMember> findByTransactionGroupIdAndIsPaidFalse(UUID groupId);
}
