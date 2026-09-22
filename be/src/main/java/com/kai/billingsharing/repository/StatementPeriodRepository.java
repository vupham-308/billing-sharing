package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.StatementPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StatementPeriodRepository extends JpaRepository<StatementPeriod, UUID> {

    List<StatementPeriod> findByGroupIdOrderByPeriodNumberDesc(UUID groupId);

    Optional<StatementPeriod> findTopByGroupIdOrderByEndDateDesc(UUID groupId);

    Optional<StatementPeriod> findByGroupIdAndPeriodNumber(UUID groupId, Integer periodNumber);
}
