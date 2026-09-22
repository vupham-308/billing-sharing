package com.kai.billingsharing.controller;

import com.kai.billingsharing.entity.EmailOutbox;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.OutboxStatus;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.EmailOutboxRepository;
import com.kai.billingsharing.service.EmailOutboxService;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin/outbox")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminOutboxController {

    private final EmailOutboxRepository emailOutboxRepository;
    private final EmailOutboxService emailOutboxService;

    /**
     * Lấy danh sách Email Outbox với phân trang, lọc theo trạng thái, loại email, và tìm kiếm từ khóa.
     */
    @GetMapping
    public ResponseEntity<Page<EmailOutbox>> getOutboxList(
            @RequestParam(required = false) OutboxStatus status,
            @RequestParam(required = false) EmailType type,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String direction
    ) {
        Sort sort = direction.equalsIgnoreCase("asc") ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(page, size, sort);

        Specification<EmailOutbox> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("recipientEmail")), pattern),
                        cb.like(cb.lower(root.get("recipientName")), pattern),
                        cb.like(cb.lower(root.get("subject")), pattern)
                ));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<EmailOutbox> result = emailOutboxRepository.findAll(spec, pageable);
        return ResponseEntity.ok(result);
    }

    /**
     * Lấy chi tiết một bản ghi Email Outbox theo ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<EmailOutbox> getOutboxDetail(@PathVariable UUID id) {
        EmailOutbox outbox = emailOutboxRepository.findById(id)
                .orElseThrow(() -> new AppException("Không tìm thấy email outbox với ID: " + id, HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(outbox);
    }

    /**
     * Admin chủ động bấm gửi lại email (Manual Retry) cho các mail UNKNOWN hoặc FAILED_PERMANENT.
     */
    @PostMapping("/{id}/retry")
    public ResponseEntity<Map<String, Object>> manualRetry(@PathVariable UUID id) {
        log.info("Admin kích hoạt Manual Retry cho outboxId={}", id);
        emailOutboxService.manualRetry(id);

        EmailOutbox updated = emailOutboxRepository.findById(id).orElse(null);
        return ResponseEntity.ok(Map.of(
                "message", "Đã yêu cầu gửi lại email thành công!",
                "outbox", updated != null ? updated : Map.of("id", id)
        ));
    }

    /**
     * Admin hủy gửi email outbox chưa gửi thành công.
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<Map<String, Object>> cancelOutbox(@PathVariable UUID id) {
        log.info("Admin hủy email outboxId={}", id);
        emailOutboxService.cancelOutbox(id);

        EmailOutbox updated = emailOutboxRepository.findById(id).orElse(null);
        return ResponseEntity.ok(Map.of(
                "message", "Đã hủy gửi email thành công!",
                "outbox", updated != null ? updated : Map.of("id", id)
        ));
    }
}
