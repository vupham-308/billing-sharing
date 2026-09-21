package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.response.BankResponse;
import com.kai.billingsharing.repository.BankRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/banks")
@RequiredArgsConstructor
public class BankController {

    private final BankRepository bankRepository;

    @GetMapping
    public ResponseEntity<List<BankResponse>> getAllActiveBanks() {
        List<BankResponse> response = bankRepository.findByIsActiveTrueOrderByCodeAsc().stream()
                .map(bank -> BankResponse.builder()
                        .id(bank.getId())
                        .code(bank.getCode())
                        .name(bank.getName())
                        .shortName(bank.getShortName())
                        .isActive(bank.getIsActive())
                        .build())
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }
}
