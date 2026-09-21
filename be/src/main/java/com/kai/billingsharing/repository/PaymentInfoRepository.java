package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.PaymentInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentInfoRepository extends JpaRepository<PaymentInfo, UUID> {

    Optional<PaymentInfo> findByUserId(UUID userId);
}
