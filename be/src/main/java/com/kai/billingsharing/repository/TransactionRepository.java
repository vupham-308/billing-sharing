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
}
