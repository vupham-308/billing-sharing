package com.kai.billingsharing.entity;

import com.kai.billingsharing.entity.enums.PaymentRequestStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Nationalized;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "payment_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRequest {

    @Id
    @GeneratedValue
    @UuidGenerator(style = UuidGenerator.Style.VERSION_7)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Version
    @Builder.Default
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Builder.Default
    @Column(name = "confirmation_count", nullable = false)
    private Integer confirmationCount = 0;

    @Builder.Default
    @Column(name = "rejection_count", nullable = false)
    private Integer rejectionCount = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    private Transaction transaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sharing_member_id")
    private TransactionSharingMember sharingMember;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "payment_request_shares",
        joinColumns = @JoinColumn(name = "payment_request_id"),
        inverseJoinColumns = @JoinColumn(name = "sharing_member_id")
    )
    private List<TransactionSharingMember> sharingMembers = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "debtor_id", nullable = false)
    private User debtor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creditor_id", nullable = false)
    private User creditor;

    @Column(name = "amount", nullable = false)
    private Long amount;

    @Column(name = "original_amount")
    private Long originalAmount;

    @Column(name = "netted_amount")
    private Long nettedAmount;

    @Nationalized
    @Column(name = "breakdown_json", columnDefinition = "NVARCHAR(MAX)")
    private String breakdownJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PaymentRequestStatus status;

    @Column(name = "identify", length = 30, unique = true)
    private String identify;

    @Nationalized
    @Column(name = "note", columnDefinition = "NVARCHAR(500)")
    private String note;

    @Column(name = "debtor_confirmed_at")
    private LocalDateTime debtorConfirmedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
