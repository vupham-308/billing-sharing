package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.Bank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BankRepository extends JpaRepository<Bank, UUID> {

    List<Bank> findByIsActiveTrueOrderByCodeAsc();

    Optional<Bank> findByCodeIgnoreCase(String code);
}
