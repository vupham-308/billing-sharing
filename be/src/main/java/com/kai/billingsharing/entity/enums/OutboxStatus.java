package com.kai.billingsharing.entity.enums;

public enum OutboxStatus {
    PENDING,
    PROCESSING,
    SENT,
    RETRY_PENDING,
    FAILED_PERMANENT,
    UNKNOWN,
    SKIPPED,
    CANCELLED
}
