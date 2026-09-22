package com.kai.billingsharing.event;

import java.util.UUID;

public record OutboxCreatedEvent(UUID outboxId) {
}
