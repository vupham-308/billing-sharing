package com.kai.billingsharing.repository;

import com.kai.billingsharing.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    @Query("SELECT DISTINCT g FROM Group g JOIN g.summaryDayOfMonth d WHERE d = :summaryDayOfMonth")
    List<Group> findBySummaryDayOfMonth(@Param("summaryDayOfMonth") Integer summaryDayOfMonth);
}
