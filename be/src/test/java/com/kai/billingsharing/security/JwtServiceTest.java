package com.kai.billingsharing.security;

import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secretKey", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970");
        // 30 days in milliseconds
        ReflectionTestUtils.setField(jwtService, "jwtExpiration", 2592000000L);
    }

    @Test
    void testGenerateAndValidateToken_30Days() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("test@example.com")
                .password("encoded_pass")
                .fullName("Nguyen Van A")
                .role(Role.USER)
                .build();

        // Check user isActive default
        assertTrue(user.getIsActive(), "User isActive builder default must be true");

        CustomUserDetails userDetails = new CustomUserDetails(user);

        String token = jwtService.generateToken(userDetails);
        assertNotNull(token);
        assertFalse(token.isBlank());

        // Validate extracted email
        String email = jwtService.extractEmail(token);
        assertEquals("test@example.com", email);

        // Validate token validity
        assertTrue(jwtService.isTokenValid(token, userDetails));
        assertFalse(jwtService.isTokenExpired(token));

        // Check expiration: should be approximately 30 days (2,592,000,000 ms)
        assertEquals(2592000000L, jwtService.getExpirationTime());
    }
}
