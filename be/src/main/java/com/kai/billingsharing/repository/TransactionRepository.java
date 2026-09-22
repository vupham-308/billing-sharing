package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    List<Transaction> findByGroupId(UUID groupId);

    @Query("SELECT DISTINCT t FROM Transaction t " +
            "LEFT JOIN FETCH t.payer " +
            "LEFT JOIN FETCH t.group " +
            "WHERE t.group.id = :groupId " +
            "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
            "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
            "ORDER BY t.createdAt ASC")
    List<Transaction> findByGroupIdAndDateRange(
            @Param("groupId") UUID groupId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );

    @Query("SELECT DISTINCT t FROM Transaction t " +
            "JOIN TransactionSharingMember tsm ON tsm.transaction = t " +
            "WHERE t.group.id = :groupId " +
            "AND (tsm.user.id = :userId OR t.payer.id = :userId) " +
            "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
            "AND (:endDate IS NULL OR t.createdAt <= :endDate)")
    Page<Transaction> findGroupTransactionsForUser(
            @Param("groupId") UUID groupId,
            @Param("userId") UUID userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );

    @Query("SELECT t FROM Transaction t " +
            "WHERE t.group.id = :groupId " +
            "AND (t.payer.id = :userId OR EXISTS (SELECT 1 FROM TransactionSharingMember m WHERE m.transaction = t AND m.user.id = :userId)) " +
            "AND (:startDate IS NULL OR t.createdAt >= :startDate) " +
            "AND (:endDate IS NULL OR t.createdAt <= :endDate) " +
            "AND (:isPaid IS NULL OR " +
            "     (:isPaid = true AND (t.payer.id = :userId OR EXISTS (SELECT 1 FROM TransactionSharingMember m1 WHERE m1.transaction = t AND m1.user.id = :userId AND m1.isPaid = true))) OR " +
            "     (:isPaid = false AND (t.payer.id != :userId AND EXISTS (SELECT 1 FROM TransactionSharingMember m2 WHERE m2.transaction = t AND m2.user.id = :userId AND (m2.isPaid = false OR m2.isPaid IS NULL)))))")
    Page<Transaction> findGroupTransactionsForUserWithStatus(
            @Param("groupId") UUID groupId,
            @Param("userId") UUID userId,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            @Param("isPaid") Boolean isPaid,
            Pageable pageable
    );
}
