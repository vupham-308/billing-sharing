package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.LoginRequest;
import com.kai.billingsharing.dto.request.RegisterRequest;
import com.kai.billingsharing.dto.response.AuthResponse;
import com.kai.billingsharing.entity.PaymentInfo;
import com.kai.billingsharing.entity.Token;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.entity.enums.TokenType;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.PaymentInfoRepository;
import com.kai.billingsharing.repository.TokenRepository;
import com.kai.billingsharing.repository.UserRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TokenRepository tokenRepository;

    @Mock
    private PaymentInfoRepository paymentInfoRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthService authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        org.springframework.test.util.ReflectionTestUtils.setField(authService, "frontendUrl", "https://kaidz.xyz");

        sampleUser = User.builder()
                .id(UUID.randomUUID())
                .email("kai@example.com")
                .password("encoded_pass")
                .fullName("Kai Nguyen")
                .role(Role.USER)
                .isActive(true)
                .balance(0L)
                .build();
    }

    @Test
    void testRegister_Success() {
        RegisterRequest request = RegisterRequest.builder()
                .email("kai@example.com")
                .password("plain_pass")
                .fullName("Kai Nguyen")
                .build();

        User unactivatedUser = User.builder()
                .id(UUID.randomUUID())
                .email("kai@example.com")
                .password("encoded_pass")
                .fullName("Kai Nguyen")
                .role(Role.USER)
                .isActive(false)
                .balance(0L)
                .build();

        when(userRepository.existsByEmail("kai@example.com")).thenReturn(false);
        when(passwordEncoder.encode("plain_pass")).thenReturn("encoded_pass");
        when(userRepository.save(any(User.class))).thenReturn(unactivatedUser);
        when(tokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertNull(response.getAccessToken(), "Chưa kích hoạt email không được cấp JWT accessToken");
        assertEquals("kai@example.com", response.getUser().getEmail());
        assertEquals("Kai Nguyen", response.getUser().getFullName());
        assertEquals(Role.USER, response.getUser().getRole());
        assertFalse(response.getUser().getIsActive(), "User mới đăng ký phải có isActive = false");

        verify(userRepository, times(1)).save(any(User.class));
        verify(tokenRepository, times(1)).save(any());
        verify(emailService, times(1)).sendAccountVerificationEmail(eq("kai@example.com"), anyString(), anyString(), eq(24));
        verify(paymentInfoRepository, never()).save(any());
    }

    @Test
    void testRegister_WithBankInfo_Success() {
        RegisterRequest request = RegisterRequest.builder()
                .email("kai_bank@example.com")
                .password("plain_pass")
                .fullName("Kai Nguyen")
                .bankCode("TPB")
                .bankName("Ngân hàng Tiên Phong")
                .accountNumber("66205002815")
                .accountHolderName("PHAM TUAN VU")
                .build();

        User unactivatedUser = User.builder()
                .id(UUID.randomUUID())
                .email("kai_bank@example.com")
                .password("encoded_pass")
                .fullName("Kai Nguyen")
                .role(Role.USER)
                .isActive(false)
                .balance(0L)
                .build();

        when(userRepository.existsByEmail("kai_bank@example.com")).thenReturn(false);
        when(passwordEncoder.encode("plain_pass")).thenReturn("encoded_pass");
        when(userRepository.save(any(User.class))).thenReturn(unactivatedUser);
        when(tokenRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        verify(paymentInfoRepository, times(1)).save(argThat(info ->
                "TPB".equals(info.getBankCode()) &&
                "66205002815".equals(info.getAccountNumber()) &&
                "PHAM TUAN VU".equals(info.getAccountHolderName())
        ));
    }

    @Test
    void testRegister_DuplicateEmail_ThrowsConflict() {
        RegisterRequest request = RegisterRequest.builder()
                .email("kai@example.com")
                .password("plain_pass")
                .fullName("Kai Nguyen")
                .build();

        when(userRepository.existsByEmail("kai@example.com")).thenReturn(true);

        AppException exception = assertThrows(AppException.class, () -> authService.register(request));
        assertEquals(HttpStatus.CONFLICT, exception.getStatus());
        assertTrue(exception.getMessage().contains("Email đã được sử dụng"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testLogin_Success() {
        LoginRequest request = LoginRequest.builder()
                .email("kai@example.com")
                .password("plain_pass")
                .build();

        when(userRepository.findByEmail("kai@example.com")).thenReturn(Optional.of(sampleUser));
        when(jwtService.generateToken(any(CustomUserDetails.class))).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationTime()).thenReturn(2592000000L);

        AuthResponse response = authService.login(request);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getAccessToken());
        assertEquals("kai@example.com", response.getUser().getEmail());
        verify(authenticationManager, times(1)).authenticate(any());
    }

    @Test
    void testLogin_WrongPassword_ThrowsUnauthorizedAppException() {
        LoginRequest request = LoginRequest.builder()
                .email("kai@example.com")
                .password("wrong_pass")
                .build();

        when(userRepository.findByEmail("kai@example.com")).thenReturn(Optional.of(sampleUser));
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        AppException exception = assertThrows(AppException.class, () -> authService.login(request));
        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatus());
    }

    @Test
    void testLogin_DisabledUser_ThrowsForbidden() {
        sampleUser.setIsActive(false);

        LoginRequest request = LoginRequest.builder()
                .email("kai@example.com")
                .password("plain_pass")
                .build();

        when(userRepository.findByEmail("kai@example.com")).thenReturn(Optional.of(sampleUser));

        AppException exception = assertThrows(AppException.class, () -> authService.login(request));
        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertTrue(exception.getMessage().contains("kích hoạt"));
    }

    @Test
    void testVerifyEmail_Success() {
        Token verificationToken = Token.builder()
                .id(UUID.randomUUID())
                .token("valid_token")
                .user(sampleUser)
                .type(TokenType.EMAIL_VERIFICATION)
                .expiryDate(LocalDateTime.now().plusHours(24))
                .used(false)
                .build();

        sampleUser.setIsActive(false);

        when(tokenRepository.findByTokenAndTypeAndUsedFalse("valid_token", TokenType.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(verificationToken));

        Map<String, String> response = authService.verifyEmail("valid_token");

        assertNotNull(response);
        assertTrue(response.get("message").contains("thành công"));
        assertTrue(sampleUser.getIsActive(), "User phải được chuyển sang isActive = true");
        assertTrue(verificationToken.getUsed(), "Token phải được đánh dấu used = true");

        verify(userRepository, times(1)).save(sampleUser);
        verify(tokenRepository, times(1)).save(verificationToken);
    }

    @Test
    void testVerifyEmail_ExpiredToken_ThrowsBadRequest() {
        Token expiredToken = Token.builder()
                .id(UUID.randomUUID())
                .token("expired_token")
                .user(sampleUser)
                .type(TokenType.EMAIL_VERIFICATION)
                .expiryDate(LocalDateTime.now().minusHours(1))
                .used(false)
                .build();

        when(tokenRepository.findByTokenAndTypeAndUsedFalse("expired_token", TokenType.EMAIL_VERIFICATION))
                .thenReturn(Optional.of(expiredToken));

        AppException ex = assertThrows(AppException.class, () -> authService.verifyEmail("expired_token"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("hết hạn"));
    }

    @Test
    void testResendVerification_Cooldown_ThrowsTooManyRequests() {
        sampleUser.setIsActive(false);

        Token recentToken = Token.builder()
                .id(UUID.randomUUID())
                .token("recent_token")
                .user(sampleUser)
                .type(TokenType.EMAIL_VERIFICATION)
                .createdAt(LocalDateTime.now().minusSeconds(30))
                .used(false)
                .build();

        when(userRepository.findByEmail("kai@example.com")).thenReturn(Optional.of(sampleUser));
        when(tokenRepository.findByUserIdAndTypeAndUsedFalse(sampleUser.getId(), TokenType.EMAIL_VERIFICATION))
                .thenReturn(List.of(recentToken));

        AppException ex = assertThrows(AppException.class, () -> authService.resendVerificationEmail("kai@example.com"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatus());
        assertTrue(ex.getMessage().contains("60 giây"));
    }
}
