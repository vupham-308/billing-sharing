package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.ForgotPasswordRequest;
import com.kai.billingsharing.dto.request.GoogleLoginRequest;
import com.kai.billingsharing.dto.request.LoginRequest;
import com.kai.billingsharing.dto.request.RegisterRequest;
import com.kai.billingsharing.dto.request.ResetPasswordRequest;
import com.kai.billingsharing.dto.response.AuthResponse;
import com.kai.billingsharing.dto.response.UserResponse;
import com.kai.billingsharing.entity.PasswordResetToken;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.PasswordResetTokenRepository;
import com.kai.billingsharing.repository.UserRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;

    @Value("${app.frontend-url:https://kaidz.xyz}")
    private String frontendUrl;

    @Value("${google.client-id:985123336976-2632ov9ava66lnlp9bd7nuct12nibh6i.apps.googleusercontent.com}")
    private String googleClientId;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new AppException("Email đã được sử dụng trong hệ thống", HttpStatus.CONFLICT);
        }

        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName().trim())
                .role(Role.USER)
                .isActive(true)
                .build();

        User savedUser = userRepository.save(user);
        CustomUserDetails userDetails = new CustomUserDetails(savedUser);
        String token = jwtService.generateToken(userDetails);

        return buildAuthResponse(savedUser, token);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword())
        );

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("Người dùng không tồn tại", HttpStatus.NOT_FOUND));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException("Tài khoản đã bị vô hiệu hóa", HttpStatus.FORBIDDEN);
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String token = jwtService.generateToken(userDetails);

        return buildAuthResponse(user, token);
    }

    @Transactional
    public Map<String, String> forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email).orElse(null);

        if (user != null && Boolean.TRUE.equals(user.getIsActive())) {
            // Sinh secret key bảo mật ngẫu nhiên 64 ký tự hex
            String secretKey = UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "");

            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .token(secretKey)
                    .user(user)
                    .expiryDate(LocalDateTime.now().plusMinutes(15))
                    .used(false)
                    .build();

            passwordResetTokenRepository.save(resetToken);

            String cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
            String resetLink = cleanFrontendUrl + "/reset-password?token=" + secretKey;

            emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), resetLink, 15);
            log.info("Đã tạo reset token cho user {} và gửi email hướng dẫn.", email);
        } else {
            log.info("Yêu cầu quên mật khẩu cho email không tồn tại hoặc bị khóa: {}", email);
        }

        return Map.of("message", "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.");
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        String tokenStr = request.getToken().trim();

        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenAndUsedFalse(tokenStr)
                .orElseThrow(() -> new AppException("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng", HttpStatus.BAD_REQUEST));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new AppException("Liên kết đặt lại mật khẩu đã hết hạn (chỉ có hiệu lực trong 15 phút)", HttpStatus.BAD_REQUEST);
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        log.info("Đặt lại mật khẩu thành công cho user: {}", user.getEmail());
        return Map.of("message", "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        if (request.getIdToken() == null || request.getIdToken().isBlank()) {
            throw new AppException("Google ID Token không được để trống", HttpStatus.BAD_REQUEST);
        }

        Map<String, Object> googlePayload;
        try {
            RestClient restClient = RestClient.create();
            googlePayload = restClient.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={token}", request.getIdToken().trim())
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Xác thực Google ID Token thất bại: {}", e.getMessage());
            throw new AppException("Google ID Token không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED);
        }

        if (googlePayload == null || googlePayload.isEmpty()) {
            throw new AppException("Không nhận được dữ liệu xác thực từ Google", HttpStatus.UNAUTHORIZED);
        }

        String aud = (String) googlePayload.get("aud");
        String azp = (String) googlePayload.get("azp");
        if (!googleClientId.equals(aud) && !googleClientId.equals(azp)) {
            log.warn("Google token audience mismatch. Expected: {}, got aud: {}, azp: {}", googleClientId, aud, azp);
            throw new AppException("Google Client ID không khớp với hệ thống", HttpStatus.UNAUTHORIZED);
        }

        Object emailVerifiedObj = googlePayload.get("email_verified");
        boolean emailVerified = Boolean.parseBoolean(String.valueOf(emailVerifiedObj));
        if (!emailVerified) {
            throw new AppException("Email từ tài khoản Google chưa được xác thực", HttpStatus.BAD_REQUEST);
        }

        String email = (String) googlePayload.get("email");
        if (email == null || email.isBlank()) {
            throw new AppException("Không tìm thấy địa chỉ email trong thông tin Google cung cấp", HttpStatus.BAD_REQUEST);
        }
        email = email.trim().toLowerCase();

        String name = (String) googlePayload.get("name");
        if (name == null || name.isBlank()) {
            name = email.split("@")[0];
        } else {
            name = name.trim();
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null) {
            if (!Boolean.TRUE.equals(user.getIsActive())) {
                throw new AppException("Tài khoản đã bị vô hiệu hóa", HttpStatus.FORBIDDEN);
            }
            if ((user.getFullName() == null || user.getFullName().isBlank()) && !name.isBlank()) {
                user.setFullName(name);
                userRepository.save(user);
            }
            log.info("Đăng nhập bằng Google thành công cho user: {}", email);
        } else {
            user = User.builder()
                    .email(email)
                    .fullName(name)
                    .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .role(Role.USER)
                    .isActive(true)
                    .balance(0L)
                    .build();
            user = userRepository.save(user);
            log.info("Tự động tạo mới tài khoản thành công từ Google cho user: {}", email);
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String token = jwtService.generateToken(userDetails);

        return buildAuthResponse(user, token);
    }

    private AuthResponse buildAuthResponse(User user, String token) {
        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .balance(user.getBalance())
                .build();

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(jwtService.getExpirationTime() / 1000)
                .user(userResponse)
                .build();
    }
}
