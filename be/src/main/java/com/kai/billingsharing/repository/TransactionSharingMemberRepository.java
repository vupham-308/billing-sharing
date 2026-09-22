package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.TransactionSharingMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

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

    @Query("SELECT s FROM TransactionSharingMember s JOIN FETCH s.user u " +
            "JOIN FETCH s.transaction t JOIN FETCH t.group JOIN FETCH t.payer " +
            "WHERE t.createdAt >= :start AND t.createdAt < :end AND u.isActive = true " +
            "ORDER BY t.createdAt, t.id")
    List<TransactionSharingMember> findNewInvoiceShares(
            @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT s FROM TransactionSharingMember s JOIN FETCH s.transaction t " +
            "JOIN FETCH s.user JOIN FETCH t.payer " +
            "WHERE s.isPaid = false AND s.user.id <> t.payer.id " +
            "AND (s.user.id IN :userIds OR t.payer.id IN :userIds)")
    List<TransactionSharingMember> findOutstandingForUsers(@Param("userIds") Collection<UUID> userIds);
}
