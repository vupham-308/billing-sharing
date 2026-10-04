package com.kai.billingsharing.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public record AdminTransactionUpdateRequest(
        @NotBlank @Size(max = 255) String title,
        @NotNull @PositiveOrZero Long totalAmount,
        @NotEmpty List<@Valid ShareUpdate> sharingMembers) {
    public record ShareUpdate(@NotNull UUID id, @NotNull @PositiveOrZero Long shareAmount,
                              @NotNull Boolean isPaid) {}
}
