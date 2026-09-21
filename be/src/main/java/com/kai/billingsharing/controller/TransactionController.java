package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.request.CreateTransactionRequest;
import com.kai.billingsharing.dto.response.PageResponse;
import com.kai.billingsharing.dto.response.TransactionDetailResponse;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;

    @PostMapping("/api/v1/groups/{groupId}/transactions")
    public ResponseEntity<TransactionDetailResponse> createTransaction(
            @PathVariable UUID groupId,
            @Valid @RequestBody CreateTransactionRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        TransactionDetailResponse response = transactionService.createTransaction(groupId, request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/api/v1/groups/{groupId}/transactions")
    public ResponseEntity<PageResponse<TransactionDetailResponse>> getGroupTransactions(
            @PathVariable UUID groupId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        PageResponse<TransactionDetailResponse> response = transactionService.getGroupTransactions(
                groupId,
                startDate,
                endDate,
                pageable,
                currentUser
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping("/api/v1/transactions/{transactionId}")
    public ResponseEntity<TransactionDetailResponse> getTransactionDetail(
            @PathVariable UUID transactionId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        TransactionDetailResponse response = transactionService.getTransactionDetail(transactionId, currentUser);
        return ResponseEntity.ok(response);
    }
}
