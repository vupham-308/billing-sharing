package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.LoginRequest;
import com.kai.billingsharing.dto.request.RegisterRequest;
import com.kai.billingsharing.dto.response.AuthResponse;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
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

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

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
        sampleUser = User.builder()
                .id(UUID.randomUUID())
                .email("kai@example.com")
                .password("encoded_pass")
                .fullName("Kai Nguyen")
                .role(Role.USER)
                .build();
    }

    @Test
    void testRegister_Success() {
        RegisterRequest request = RegisterRequest.builder()
                .email("kai@example.com")
                .password("plain_pass")
                .fullName("Kai Nguyen")
                .build();

        when(userRepository.existsByEmail("kai@example.com")).thenReturn(false);
        when(passwordEncoder.encode("plain_pass")).thenReturn("encoded_pass");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtService.generateToken(any(CustomUserDetails.class))).thenReturn("mocked.jwt.token");
        when(jwtService.getExpirationTime()).thenReturn(2592000000L);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mocked.jwt.token", response.getAccessToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals(2592000L, response.getExpiresIn());
        assertEquals("kai@example.com", response.getUser().getEmail());
        assertEquals("Kai Nguyen", response.getUser().getFullName());
        assertEquals(Role.USER, response.getUser().getRole());
        assertTrue(sampleUser.getIsActive(), "User isActive default must be true");

        verify(userRepository, times(1)).save(any(User.class));
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
    void testLogin_WrongPassword_ThrowsBadCredentialsException() {
        LoginRequest request = LoginRequest.builder()
                .email("kai@example.com")
                .password("wrong_pass")
                .build();

        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        assertThrows(BadCredentialsException.class, () -> authService.login(request));
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
        assertTrue(exception.getMessage().contains("vô hiệu hóa"));
    }
}
