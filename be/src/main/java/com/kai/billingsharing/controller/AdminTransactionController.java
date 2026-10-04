package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.response.*;
import com.kai.billingsharing.dto.request.AdminTransactionUpdateRequest;
import jakarta.validation.Valid;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.GroupRepository;
import com.kai.billingsharing.service.AdminTransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/transactions")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminTransactionController {
    private final AdminTransactionService service;
    private final GroupRepository groups;

    @PutMapping("/{id}")
    public void update(@PathVariable UUID id, @Valid @RequestBody AdminTransactionUpdateRequest request) {
        service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestParam(defaultValue = "false") boolean adjustBalances) {
        service.delete(id, adjustBalances);
    }

    @GetMapping
    public PageResponse<AdminTransactionResponse> list(
            @RequestParam(required = false) UUID groupId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean paid,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new AppException("Trang phải >= 0 và số hóa đơn mỗi trang từ 1 đến 100", HttpStatus.BAD_REQUEST);
        return service.list(groupId, search, paid, page, size);
    }

    public record GroupOption(UUID id, String name) {}

    @GetMapping("/groups")
    public List<GroupOption> groups() {
        return groups.findAll(Sort.by("name", "id")).stream()
                .map(g -> new GroupOption(g.getId(), g.getName())).toList();
    }
}
