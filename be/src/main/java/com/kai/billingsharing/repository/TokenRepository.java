package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.Token;
import com.kai.billingsharing.entity.enums.TokenType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TokenRepository extends JpaRepository<Token, UUID> {

    Optional<Token> findByTokenAndTypeAndUsedFalse(String token, TokenType type);

    Optional<Token> findByToken(String token);

    List<Token> findByUserIdAndTypeAndUsedFalse(UUID userId, TokenType type);

    @Modifying
    @Transactional
    @Query("DELETE FROM Token t WHERE t.expiryDate < :now OR t.used = true")
    int deleteExpiredOrUsedTokens(@Param("now") LocalDateTime now);
}
