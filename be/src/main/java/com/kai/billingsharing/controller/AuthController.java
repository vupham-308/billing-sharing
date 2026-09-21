package com.kai.billingsharing.controller;

import com.kai.billingsharing.dto.request.LoginRequest;
import com.kai.billingsharing.dto.request.RegisterRequest;
import com.kai.billingsharing.dto.response.AuthResponse;
import com.kai.billingsharing.dto.response.UserResponse;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal CustomUserDetails userDetails) {
        UserResponse response = UserResponse.builder()
                .id(userDetails.getId())
                .email(userDetails.getEmail())
                .fullName(userDetails.getUser().getFullName())
                .role(userDetails.getUser().getRole())
                .balance(userDetails.getUser().getBalance())
                .build();
        return ResponseEntity.ok(response);
    }
}
