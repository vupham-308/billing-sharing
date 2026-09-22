package com.kai.billingsharing.service;

import com.kai.billingsharing.dto.request.ForgotPasswordRequest;
import com.kai.billingsharing.dto.request.GoogleLoginRequest;
import com.kai.billingsharing.dto.request.LoginRequest;
import com.kai.billingsharing.dto.request.RegisterRequest;
import com.kai.billingsharing.dto.request.ResetPasswordRequest;
import com.kai.billingsharing.dto.response.AuthResponse;
import com.kai.billingsharing.dto.response.UserResponse;
import com.kai.billingsharing.entity.PaymentInfo;
import com.kai.billingsharing.entity.Token;
import com.kai.billingsharing.entity.User;
import com.kai.billingsharing.entity.enums.EmailType;
import com.kai.billingsharing.entity.enums.Role;
import com.kai.billingsharing.entity.enums.TokenType;
import com.kai.billingsharing.exception.AppException;
import com.kai.billingsharing.repository.PaymentInfoRepository;
import com.kai.billingsharing.repository.TokenRepository;
import com.kai.billingsharing.repository.UserRepository;
import com.kai.billingsharing.security.CustomUserDetails;
import com.kai.billingsharing.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TokenRepository tokenRepository;
    private final PaymentInfoRepository paymentInfoRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailService emailService;
    private final EmailOutboxService emailOutboxService;

    @Value("${app.frontend-url:https://kaidz.xyz}")
    private String frontendUrl = "https://kaidz.xyz";

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
                .isActive(false) // Yêu cầu kích hoạt qua email trước khi đăng nhập
                .balance(0L)
                .build();

        User savedUser = userRepository.save(user);

        // Lưu thông tin ngân hàng ngay khi đăng ký nếu người dùng nhập ở Bước 2
        if (request.getAccountNumber() != null && !request.getAccountNumber().isBlank()
                && request.getBankCode() != null && !request.getBankCode().isBlank()) {
            PaymentInfo paymentInfo = PaymentInfo.builder()
                    .user(savedUser)
                    .bankCode(request.getBankCode().trim())
                    .bankName(request.getBankName() != null ? request.getBankName().trim() : request.getBankCode().trim())
                    .accountNumber(request.getAccountNumber().trim())
                    .accountHolderName(request.getAccountHolderName() != null 
                            ? request.getAccountHolderName().trim().toUpperCase() 
                            : savedUser.getFullName().trim().toUpperCase())
                    .build();
            paymentInfoRepository.save(paymentInfo);
            log.info("Đã lưu thông tin tài khoản ngân hàng khởi tạo cho user: {}", email);
        }

        // Sinh token kích hoạt tài khoản (64 ký tự ngẫu nhiên)
        String secretKey = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");

        Token verificationToken = Token.builder()
                .token(secretKey)
                .user(savedUser)
                .type(TokenType.EMAIL_VERIFICATION)
                .expiryDate(LocalDateTime.now().plusHours(24))
                .used(false)
                .build();

        tokenRepository.save(verificationToken);

        String cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        String verifyLink = cleanFrontendUrl + "/verify-email?token=" + secretKey;
        String html = emailService.buildAccountVerificationHtml(savedUser.getFullName(), verifyLink, 24);
        String payloadJson = "{\"userId\":\"" + savedUser.getId() + "\",\"tokenId\":\"" + verificationToken.getId() + "\"}";
        String businessKey = "EMAIL_VERIFICATION:" + savedUser.getId() + ":" + verificationToken.getId();

        emailOutboxService.recordOutbox(
                EmailType.EMAIL_VERIFICATION,
                savedUser.getEmail(),
                savedUser.getFullName(),
                "Kích hoạt tài khoản ChiaTiền của bạn",
                html,
                payloadJson,
                businessKey,
                LocalDate.now()
        );
        log.info("Đã tạo outbox kích hoạt tài khoản cho user: {}", email);

        // Trả về thông tin user với isActive = false, accessToken = null
        return buildAuthResponse(savedUser, null);
    }

    @Transactional
    public Map<String, String> verifyEmail(String tokenStr) {
        if (tokenStr == null || tokenStr.isBlank()) {
            throw new AppException("Mã xác thực token không hợp lệ", HttpStatus.BAD_REQUEST);
        }

        Token token = tokenRepository.findByTokenAndTypeAndUsedFalse(tokenStr.trim(), TokenType.EMAIL_VERIFICATION)
                .orElseThrow(() -> new AppException("Liên kết kích hoạt không hợp lệ hoặc đã được sử dụng", HttpStatus.BAD_REQUEST));

        if (token.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new AppException("Liên kết kích hoạt đã hết hạn (chỉ có hiệu lực trong 24 giờ). Vui lòng yêu cầu gửi lại email kích hoạt.", HttpStatus.BAD_REQUEST);
        }

        User user = token.getUser();
        user.setIsActive(true);
        userRepository.save(user);

        token.setUsed(true);
        tokenRepository.save(token);

        log.info("Kích hoạt tài khoản thành công cho user: {}", user.getEmail());
        return Map.of("message", "Tài khoản của bạn đã được kích hoạt thành công! Bạn có thể đăng nhập ngay bây giờ.");
    }

    @Transactional
    public Map<String, String> resendVerificationEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new AppException("Email không được để trống", HttpStatus.BAD_REQUEST);
        }
        String normalizedEmail = email.trim().toLowerCase();

        User user = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (user == null) {
            return Map.of("message", "Nếu email tồn tại trong hệ thống và chưa kích hoạt, email hướng dẫn đã được gửi đến hộp thư của bạn.");
        }

        if (Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException("Tài khoản này đã được kích hoạt từ trước. Bạn có thể đăng nhập ngay.", HttpStatus.BAD_REQUEST);
        }

        // Kiểm tra cooldown 60 giây
        List<Token> existingTokens = tokenRepository.findByUserIdAndTypeAndUsedFalse(user.getId(), TokenType.EMAIL_VERIFICATION);
        for (Token t : existingTokens) {
            if (t.getCreatedAt() != null && t.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(60))) {
                throw new AppException("Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email kích hoạt.", HttpStatus.TOO_MANY_REQUESTS);
            }
            t.setUsed(true); // Vô hiệu hóa token cũ
        }
        tokenRepository.saveAll(existingTokens);

        String secretKey = UUID.randomUUID().toString().replace("-", "")
                + UUID.randomUUID().toString().replace("-", "");

        Token newToken = Token.builder()
                .token(secretKey)
                .user(user)
                .type(TokenType.EMAIL_VERIFICATION)
                .expiryDate(LocalDateTime.now().plusHours(24))
                .used(false)
                .build();

        tokenRepository.save(newToken);

        String cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        String verifyLink = cleanFrontendUrl + "/verify-email?token=" + secretKey;
        String html = emailService.buildAccountVerificationHtml(user.getFullName(), verifyLink, 24);
        String payloadJson = "{\"userId\":\"" + user.getId() + "\",\"tokenId\":\"" + newToken.getId() + "\"}";
        String businessKey = "EMAIL_VERIFICATION:" + user.getId() + ":" + newToken.getId();

        emailOutboxService.recordOutbox(
                EmailType.EMAIL_VERIFICATION,
                user.getEmail(),
                user.getFullName(),
                "Kích hoạt tài khoản ChiaTiền của bạn",
                html,
                payloadJson,
                businessKey,
                LocalDate.now()
        );
        log.info("Đã tạo outbox gửi lại email kích hoạt cho user: {}", normalizedEmail);

        return Map.of("message", "Email kích hoạt đã được gửi lại thành công! Vui lòng kiểm tra hộp thư của bạn.");
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new AppException("Email hoặc mật khẩu không chính xác", HttpStatus.UNAUTHORIZED));

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new AppException("Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư email của bạn để kích hoạt tài khoản.", HttpStatus.FORBIDDEN);
        }

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword())
            );
        } catch (BadCredentialsException e) {
            throw new AppException("Email hoặc mật khẩu không chính xác", HttpStatus.UNAUTHORIZED);
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
            String secretKey = UUID.randomUUID().toString().replace("-", "")
                    + UUID.randomUUID().toString().replace("-", "");

            Token resetToken = Token.builder()
                    .token(secretKey)
                    .user(user)
                    .type(TokenType.PASSWORD_RESET)
                    .expiryDate(LocalDateTime.now().plusMinutes(15))
                    .used(false)
                    .build();

            tokenRepository.save(resetToken);

            String cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
            String resetLink = cleanFrontendUrl + "/reset-password?token=" + secretKey;
            String html = emailService.buildPasswordResetHtml(user.getFullName(), resetLink, 15);
            String payloadJson = "{\"userId\":\"" + user.getId() + "\",\"tokenId\":\"" + resetToken.getId() + "\"}";
            String businessKey = "PASSWORD_RESET:" + user.getId() + ":" + resetToken.getId();

            emailOutboxService.recordOutbox(
                    EmailType.PASSWORD_RESET,
                    user.getEmail(),
                    user.getFullName(),
                    "Yêu cầu đặt lại mật khẩu - ChiaTiền",
                    html,
                    payloadJson,
                    businessKey,
                    LocalDate.now()
            );
            log.info("Đã tạo outbox đặt lại mật khẩu cho user: {}", email);
        } else {
            log.info("Yêu cầu quên mật khẩu cho email không tồn tại hoặc bị khóa: {}", email);
        }

        return Map.of("message", "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.");
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        String tokenStr = request.getToken().trim();

        Token resetToken = tokenRepository.findByTokenAndTypeAndUsedFalse(tokenStr, TokenType.PASSWORD_RESET)
                .orElseThrow(() -> new AppException("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng", HttpStatus.BAD_REQUEST));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            throw new AppException("Liên kết đặt lại mật khẩu đã hết hạn (chỉ có hiệu lực trong 15 phút)", HttpStatus.BAD_REQUEST);
        }

        User user = resetToken.getUser();
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        String changedTime = LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy"));
        String cleanFrontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
        String resetPasswordUrl = cleanFrontendUrl + "/forgot-password";
        String html = emailService.buildPasswordChangedHtml(user.getFullName(), changedTime, resetPasswordUrl);
        String businessKey = "PASSWORD_CHANGED:" + user.getId() + ":" + System.currentTimeMillis();

        emailOutboxService.recordOutbox(
                EmailType.PASSWORD_CHANGED,
                user.getEmail(),
                user.getFullName(),
                "Thông báo bảo mật: Mật khẩu của bạn đã được thay đổi - ChiaTiền",
                html,
                null,
                businessKey,
                LocalDate.now()
        );

        log.info("Đặt lại mật khẩu thành công cho user: {}", user.getEmail());
        return Map.of("message", "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.");
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        if (request.getIdToken() == null || request.getIdToken().isBlank()) {
            throw new AppException("Google ID Token không được để trống", HttpStatus.BAD_REQUEST);
        }

        Map<String, Object> googlePayload = fetchGooglePayload(request.getIdToken());

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

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            name = request.getFullName().trim();
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user != null) {
            if (!Boolean.TRUE.equals(user.getIsActive())) {
                // Nếu tài khoản trước đó chưa kích hoạt nhưng đăng nhập thành công qua Google (email đã verify) thì kích hoạt luôn
                user.setIsActive(true);
                userRepository.save(user);
            }
            if ((user.getFullName() == null || user.getFullName().isBlank()) && !name.isBlank()) {
                user.setFullName(name);
                userRepository.save(user);
            }

            // Nếu người dùng cũ chưa có PaymentInfo và có gửi kèm bank info thì bổ sung luôn
            boolean hasBankInfo = request.getAccountNumber() != null && !request.getAccountNumber().isBlank()
                    && request.getBankCode() != null && !request.getBankCode().isBlank();
            if (hasBankInfo && paymentInfoRepository.findByUserId(user.getId()).isEmpty()) {
                PaymentInfo paymentInfo = PaymentInfo.builder()
                        .user(user)
                        .bankCode(request.getBankCode().trim())
                        .bankName(request.getBankName() != null ? request.getBankName().trim() : request.getBankCode().trim())
                        .accountNumber(request.getAccountNumber().trim())
                        .accountHolderName(request.getAccountHolderName() != null
                                ? request.getAccountHolderName().trim().toUpperCase()
                                : user.getFullName().trim().toUpperCase())
                        .build();
                paymentInfoRepository.save(paymentInfo);
                log.info("Bổ sung thông tin tài khoản ngân hàng từ Google cho user đã tồn tại: {}", email);
            }

            log.info("Đăng nhập bằng Google thành công cho user: {}", email);
        } else {
            // User Google chưa tồn tại trong hệ thống
            boolean hasBankInfo = request.getAccountNumber() != null && !request.getAccountNumber().isBlank()
                    && request.getBankCode() != null && !request.getBankCode().isBlank();

            if (!hasBankInfo) {
                log.info("User Google chưa tồn tại trong hệ thống, chuyển sang yêu cầu nhập STK ngân hàng: {}", email);
                return AuthResponse.builder()
                        .isNewUser(true)
                        .tokenType(null)
                        .user(UserResponse.builder()
                                .email(email)
                                .fullName(name)
                                .role(Role.USER)
                                .balance(0L)
                                .isActive(true)
                                .build())
                        .build();
            }

            user = User.builder()
                    .email(email)
                    .fullName(name)
                    .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                    .role(Role.USER)
                    .isActive(true) // Google email đã được xác minh nên kích hoạt luôn
                    .balance(0L)
                    .build();

            try {
                user = userRepository.save(user);
                log.info("Tạo mới tài khoản thành công từ Google cho user: {}", email);
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                log.warn("User {} đã được tạo bởi một request đồng thời, lấy lại từ DB", email);
                user = userRepository.findByEmail(email).orElseThrow(() -> e);
            }

            if (paymentInfoRepository.findByUserId(user.getId()).isEmpty()) {
                PaymentInfo paymentInfo = PaymentInfo.builder()
                        .user(user)
                        .bankCode(request.getBankCode().trim())
                        .bankName(request.getBankName() != null ? request.getBankName().trim() : request.getBankCode().trim())
                        .accountNumber(request.getAccountNumber().trim())
                        .accountHolderName(request.getAccountHolderName() != null
                                ? request.getAccountHolderName().trim().toUpperCase()
                                : user.getFullName().trim().toUpperCase())
                        .build();
                paymentInfoRepository.save(paymentInfo);
                log.info("Đã lưu thông tin tài khoản ngân hàng khởi tạo từ Google cho user: {}", email);
            }
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
                .isActive(user.getIsActive())
                .build();

        return AuthResponse.builder()
                .accessToken(token)
                .tokenType(token != null ? "Bearer" : null)
                .expiresIn(token != null ? jwtService.getExpirationTime() / 1000 : null)
                .user(userResponse)
                .isNewUser(false)
                .build();
    }

    Map<String, Object> fetchGooglePayload(String idToken) {
        try {
            RestClient restClient = RestClient.create();
            return restClient.get()
                    .uri("https://oauth2.googleapis.com/tokeninfo?id_token={token}", idToken.trim())
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Xác thực Google ID Token thất bại: {}", e.getMessage());
            throw new AppException("Google ID Token không hợp lệ hoặc đã hết hạn", HttpStatus.UNAUTHORIZED);
        }
    }
}

