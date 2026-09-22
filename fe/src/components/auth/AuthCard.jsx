import React, { useState, useEffect, useCallback } from "react";
import {
  LogIn,
  UserPlus,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  MailCheck,
  Send,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authApi, bankApi } from "../../services/api";
import BankSelect from "../common/BankSelect";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "985123336976-2632ov9ava66lnlp9bd7nuct12nibh6i.apps.googleusercontent.com";

function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
}

export default function AuthCard({ initialMode = "LOGIN" }) {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState(initialMode); // "LOGIN" | "REGISTER" | "FORGOT"
  const [registerStep, setRegisterStep] = useState(1); // 1: Thông tin tài khoản, 2: Cài đặt STK VietQR
  const [isGsiRendered, setIsGsiRendered] = useState(false);

  // Google pending registration states
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState(null);

  // Form inputs
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Bank Info for Register Step 2
  const [banks, setBanks] = useState([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isHolderTouched, setIsHolderTouched] = useState(false);

  // States
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email verification states
  const [registeredPendingEmail, setRegisteredPendingEmail] = useState("");
  const [unverifiedLoginEmail, setUnverifiedLoginEmail] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendSuccessMsg, setResendSuccessMsg] = useState("");
  const [isResending, setIsResending] = useState(false);

  // Khôi phục phiên đăng ký Google pending (nếu vừa redirect từ /callback)
  useEffect(() => {
    try {
      const pendingStr = sessionStorage.getItem("google_pending_registration");
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        if (pending.idToken) {
          setGoogleIdToken(pending.idToken);
          setIsGoogleAuth(true);
          setName(pending.fullName || "");
          setEmail(pending.email || "");
          setAccountHolderName(removeVietnameseTones(pending.fullName || ""));
          setMode("REGISTER");
          setRegisterStep(2);
        }
      }
    } catch (e) {
      console.error("Lỗi khi khôi phục thông tin đăng ký Google:", e);
    }
  }, []);

  // Nạp danh sách ngân hàng từ Database qua API (Tuyệt đối không dùng fallback tĩnh)
  useEffect(() => {
    let isCancelled = false;
    async function loadBanks() {
      setIsLoadingBanks(true);
      try {
        const data = await bankApi.getBanks();
        if (!isCancelled && Array.isArray(data)) {
          setBanks(data);
          if (data.length > 0 && !bankCode) {
            setBankCode(data[0].code);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách ngân hàng:", err);
      } finally {
        if (!isCancelled) setIsLoadingBanks(false);
      }
    }
    loadBanks();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!isHolderTouched) {
      setAccountHolderName(removeVietnameseTones(val));
    }
  };

  const handleSwitchMode = (newMode) => {
    setError("");
    setSuccessMessage("");
    setResendSuccessMsg("");
    setUnverifiedLoginEmail("");
    setMode(newMode);
    setRegisterStep(1);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsGoogleAuth(false);
    setGoogleIdToken(null);
    sessionStorage.removeItem("google_pending_registration");
  };

  const handleResendVerification = async (targetEmail) => {
    if (!targetEmail) return;
    setIsResending(true);
    setResendSuccessMsg("");
    setError("");
    try {
      const res = await authApi.resendVerification(targetEmail.trim());
      setResendSuccessMsg(res.message || "Đã gửi lại email kích hoạt! Vui lòng kiểm tra hộp thư của bạn.");
      setResendCountdown(60);
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Không thể gửi lại email kích hoạt.");
    } finally {
      setIsResending(false);
    }
  };

  // Xử lý xác thực khi nhận credential (ID token) từ Google Identity Services
  const handleGoogleCredentialResponse = useCallback(
    async (response) => {
      if (!response || !response.credential) {
        setError("Không nhận được token xác thực từ Google. Vui lòng thử lại.");
        return;
      }
      setIsSubmitting(true);
      setError("");
      try {
        const result = await loginWithGoogle(response.credential);
        if (result.isNewUser) {
          // User Google chưa có trong hệ thống -> chuyển sang Bước 2 cài đặt STK VietQR
          const pending = {
            idToken: response.credential,
            email: result.email,
            fullName: result.fullName,
          };
          sessionStorage.setItem("google_pending_registration", JSON.stringify(pending));
          setGoogleIdToken(response.credential);
          setIsGoogleAuth(true);
          setName(result.fullName || "");
          setEmail(result.email || "");
          setAccountHolderName(removeVietnameseTones(result.fullName || ""));
          setMode("REGISTER");
          setRegisterStep(2);
          return;
        }
        if (!result.success) {
          setError(result.message || "Đăng nhập bằng Google thất bại.");
        }
      } catch (err) {
        setError(err.message || "Lỗi khi kết nối đăng nhập Google.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginWithGoogle]
  );

  // Đăng nhập trực tiếp bằng Google OAuth redirect tới /callback
  const handleDirectGoogleLogin = () => {
    const callbackUrl = window.location.origin + "/callback";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      callbackUrl
    )}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36)}`;
    window.location.href = authUrl;
  };

  // Khởi tạo Google Identity Services Button CHỈ trong LOGIN mode
  useEffect(() => {
    if (mode !== "LOGIN") return;

    let timer;
    function setupGoogleButton() {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          const btnElem = document.getElementById("googleSignInButton");
          if (btnElem) {
            btnElem.innerHTML = "";
            window.google.accounts.id.renderButton(btnElem, {
              theme: "outline",
              size: "large",
              width: btnElem.offsetWidth > 240 ? btnElem.offsetWidth : 360,
              text: "signin_with",
              shape: "rectangular",
              logo_alignment: "left",
            });
            setIsGsiRendered(true);
          }
        } catch (e) {
          console.error("Lỗi khi khởi tạo Google Sign-In:", e);
        }
      }
    }

    setupGoogleButton();
    timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        setupGoogleButton();
        clearInterval(timer);
      }
    }, 300);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mode, handleGoogleCredentialResponse]);

  // Kiểm tra tính hợp lệ Bước 1 của Đăng ký
  const handleNextStep = (e) => {
    if (e) e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Vui lòng nhập họ và tên của bạn");
      return;
    }
    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ email");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Địa chỉ email không đúng định dạng");
      return;
    }
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (!confirmPassword) {
      setError("Vui lòng nhập lại mật khẩu xác nhận");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    setRegisterStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    // 1. FORGOT PASSWORD
    if (mode === "FORGOT") {
      if (!email.trim()) {
        setError("Vui lòng nhập địa chỉ email");
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await authApi.forgotPassword(email.trim());
        setSuccessMessage(res.message || "Đã gửi email hướng dẫn đặt lại mật khẩu!");
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Không thể gửi yêu cầu đặt lại mật khẩu.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. REGISTER STEP 1
    if (mode === "REGISTER" && registerStep === 1) {
      handleNextStep(e);
      return;
    }

    // 3. REGISTER STEP 2
    if (mode === "REGISTER" && registerStep === 2) {
      if (!bankCode) {
        setError("Vui lòng chọn ngân hàng thụ hưởng");
        return;
      }
      if (!accountNumber.trim()) {
        setError("Vui lòng nhập số tài khoản ngân hàng để nhận tiền");
        return;
      }
      if (!accountHolderName.trim()) {
        setError("Vui lòng nhập tên chủ tài khoản");
        return;
      }

      setIsSubmitting(true);
      try {
        const selectedBank = banks.find((b) => b.code === bankCode);
        const bankPayload = {
          bankCode,
          bankName: selectedBank?.name || bankCode,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim().toUpperCase(),
        };

        if (isGoogleAuth && googleIdToken) {
          const res = await loginWithGoogle({
            idToken: googleIdToken,
            fullName: name.trim(),
            ...bankPayload,
          });
          if (!res.success) {
            setError(res.message || "Đăng ký bằng Google thất bại. Vui lòng thử lại.");
          } else {
            sessionStorage.removeItem("google_pending_registration");
          }
        } else {
          const res = await register(name.trim(), email.trim(), password, bankPayload);
          if (!res.success) {
            setError(res.message);
          } else if (res.needActivation) {
            setRegisteredPendingEmail(email.trim());
          }
        }
      } catch (err) {
        setError(err.message || "Xác thực thất bại");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 4. LOGIN
    if (mode === "LOGIN") {
      if (!email.trim() || !password.trim()) {
        setError("Vui lòng điền đầy đủ email và mật khẩu");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await login(email.trim(), password);
        if (!res.success) {
          setError(res.message);
          if (res.needActivation) {
            setUnverifiedLoginEmail(email.trim());
          } else {
            setUnverifiedLoginEmail("");
          }
        }
      } catch (err) {
        setError(err.message || "Xác thực thất bại");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Header tab navigation */}
      <div className="flex items-center border-b border-slate-100 bg-slate-50/70 p-1">
        <button
          type="button"
          onClick={() => handleSwitchMode("LOGIN")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mode === "LOGIN"
              ? "bg-white text-indigo-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Đăng nhập</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode("REGISTER")}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
            mode === "REGISTER"
              ? "bg-white text-indigo-600 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Đăng ký</span>
        </button>
      </div>

      {/* Hiển thị màn hình thông báo kích hoạt tài khoản nếu vừa hoàn tất Đăng ký */}
      {registeredPendingEmail ? (
        <div className="p-6 sm:p-7 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto ring-8 ring-indigo-50/50">
            <MailCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Đăng ký thành công!
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Chúng tôi đã gửi một liên kết kích hoạt đến địa chỉ email:
              <br />
              <strong className="text-slate-900 font-semibold text-sm">{registeredPendingEmail}</strong>
            </p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Vui lòng kiểm tra hộp thư email (bao gồm cả mục Thư rác/Spam) và bấm vào nút <strong>"Kích hoạt tài khoản ngay"</strong> để bắt đầu sử dụng.
            </p>
          </div>

          {resendSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl">
              {resendSuccessMsg}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isResending || resendCountdown > 0}
              onClick={() => handleResendVerification(registeredPendingEmail)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isResending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>
                {resendCountdown > 0
                  ? `Gửi lại sau (${resendCountdown}s)`
                  : "Chưa nhận được thư? Gửi lại email kích hoạt"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRegisteredPendingEmail("");
                handleSwitchMode("LOGIN");
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
            >
              Đã kích hoạt? Đăng nhập ngay
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Title */}
          <div className="text-center pb-1">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {mode === "LOGIN" && "Chào mừng bạn trở lại"}
              {mode === "REGISTER" &&
                (registerStep === 1
                  ? "Đăng ký tài khoản Billing Sharing"
                  : "Cài đặt tài khoản nhận tiền")}
              {mode === "FORGOT" && "Quên mật khẩu tài khoản"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {mode === "LOGIN" && "Đăng nhập để xem sao kê và chi tiêu nhóm"}
              {mode === "REGISTER" &&
                (registerStep === 1
                  ? "Bước 1/2: Nhập thông tin tài khoản và mật khẩu"
                  : "Bước 2/2: Nhập STK VietQR nhận tiền tự động")}
              {mode === "FORGOT" && "Nhập email đã đăng ký để nhận liên kết khôi phục"}
            </p>
          </div>

          {/* Step Indicator for Register */}
          {mode === "REGISTER" && (
            <div className="flex items-center justify-center gap-2 py-1">
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  registerStep === 1
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-emerald-100 text-emerald-700 cursor-pointer"
                }`}
                onClick={() => {
                  if (registerStep === 2) {
                    if (isGoogleAuth) {
                      setIsGoogleAuth(false);
                      setGoogleIdToken(null);
                      sessionStorage.removeItem("google_pending_registration");
                    }
                    setRegisterStep(1);
                  }
                }}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                  1
                </span>
                <span>Thông tin tài khoản</span>
              </div>
              <div className="w-5 h-0.5 bg-slate-200" />
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  registerStep === 2
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px]">
                  2
                </span>
                <span>STK VietQR</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </div>
              {unverifiedLoginEmail && (
                <div className="pt-2 border-t border-rose-200/70 flex items-center justify-between">
                  <span className="text-[11px] text-rose-600 font-medium">Chưa nhận được email?</span>
                  <button
                    type="button"
                    disabled={isResending || resendCountdown > 0}
                    onClick={() => handleResendVerification(unverifiedLoginEmail)}
                    className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isResending && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>
                      {resendCountdown > 0
                        ? `Gửi lại (${resendCountdown}s)`
                        : "Gửi lại email kích hoạt"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resend success notification */}
          {resendSuccessMsg && (
            <div className="flex items-start gap-2 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{resendSuccessMsg}</span>
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div className="flex items-start gap-2 p-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

        {/* ==================== REGISTER STEP 1 OR LOGIN OR FORGOT ==================== */}

        {/* Register Step 1: Họ và tên */}
        {mode === "REGISTER" && registerStep === 1 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <input
              type="text"
              placeholder="VD: Nguyễn Văn Nam"
              value={name}
              onChange={handleNameChange}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        )}

        {/* Email (cho Login, Register Step 1, Forgot) */}
        {(mode !== "REGISTER" || registerStep === 1) && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              placeholder="VD: nam@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        )}

        {/* Mật khẩu (cho Login & Register Step 1) */}
        {mode !== "FORGOT" && (mode !== "REGISTER" || registerStep === 1) && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Mật khẩu
              </label>
              {mode === "LOGIN" && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode("FORGOT")}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Register Step 1: Xác nhận mật khẩu lần 2 */}
        {mode === "REGISTER" && registerStep === 1 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ==================== REGISTER STEP 2: TÀI KHOẢN NHẬN TIỀN VIETQR ==================== */}
        {mode === "REGISTER" && registerStep === 2 && (
          <div className="space-y-4">
            {isGoogleAuth && email && (
              <div className="flex items-center gap-2.5 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div className="truncate">
                  <span>Hoàn tất đăng ký Google: </span>
                  <strong className="font-semibold text-slate-800">{email}</strong>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-indigo-600" />
              <span>Tài khoản nhận tiền VietQR (Bắt buộc)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngân hàng thụ hưởng
              </label>
              <BankSelect
                banks={banks}
                value={bankCode}
                onChange={setBankCode}
                disabled={isLoadingBanks}
                placeholder={isLoadingBanks ? "Đang tải danh sách ngân hàng..." : "Chọn ngân hàng thụ hưởng"}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Số tài khoản ngân hàng
              </label>
              <input
                type="text"
                placeholder="VD: 0123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Tên chủ tài khoản (In hoa không dấu)
              </label>
              <input
                type="text"
                placeholder="VD: NGUYEN VAN NAM"
                value={accountHolderName}
                onChange={(e) => {
                  setIsHolderTouched(true);
                  setAccountHolderName(removeVietnameseTones(e.target.value));
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                STK dùng để tự động tạo mã VietQR SePay nhận tiền từ các thành viên trong nhóm chi tiêu.
              </span>
            </div>
          </div>
        )}

        {/* ==================== BUTTONS / ACTIONS ==================== */}
        {/* Register Step 2 Actions */}
        {mode === "REGISTER" && registerStep === 2 ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                if (isGoogleAuth) {
                  setIsGoogleAuth(false);
                  setGoogleIdToken(null);
                  sessionStorage.removeItem("google_pending_registration");
                }
                setRegisterStep(1);
              }}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? "Đang xử lý..." : "Tạo tài khoản & Bắt đầu"}
            </button>
          </div>
        ) : mode === "REGISTER" && registerStep === 1 ? (
          /* Nút Tiếp tục ở Bước 1: type="button", gọi handleNextStep trực tiếp, KHÔNG submit form */
          <button
            type="button"
            onClick={handleNextStep}
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all mt-2 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Tiếp tục sang Bước 2</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          /* Single Submit Button for Login, Forgot */
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 mt-2 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting
              ? "Đang xử lý..."
              : mode === "LOGIN"
              ? "Đăng nhập"
              : "Gửi liên kết đặt lại mật khẩu"}
          </button>
        )}

        {/* Divider & Google Login (Chỉ hiển thị ở LOGIN hoặc REGISTER BƯỚC 1) */}
        {(mode === "LOGIN" || (mode === "REGISTER" && registerStep === 1)) && (
          <div className="space-y-3 pt-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-400 font-medium">Hoặc tiếp tục với</span>
              </div>
            </div>

            {/* Google Sign-In Container */}
            <div className="flex flex-col items-center w-full">
              {mode === "LOGIN" ? (
                <>
                  <div
                    id="googleSignInButton"
                    className={`w-full flex justify-center min-h-[44px] ${!isGsiRendered ? "hidden" : ""}`}
                  ></div>

                  {!isGsiRendered && (
                    <button
                      type="button"
                      onClick={handleDirectGoogleLogin}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Đăng nhập bằng Google</span>
                    </button>
                  )}
                </>
              ) : (
                /* Trong REGISTER Bước 1: Dùng nút OAuth trực tiếp, tuyệt đối không chèn iframe One-Tap tự log */
                <button
                  type="button"
                  onClick={handleDirectGoogleLogin}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Đăng ký nhanh bằng Google</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer toggles */}
        <div className="pt-2 text-center text-xs text-slate-500">
          {mode === "LOGIN" && (
            <span>
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("REGISTER")}
                className="font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Đăng ký ngay
              </button>
            </span>
          )}

          {mode === "REGISTER" && (
            <span>
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => handleSwitchMode("LOGIN")}
                className="font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Đăng nhập
              </button>
            </span>
          )}

          {mode === "FORGOT" && (
            <button
              type="button"
              onClick={() => handleSwitchMode("LOGIN")}
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Quay lại trang Đăng nhập</span>
            </button>
          )}
        </div>
      </form>
      )}
    </div>
  );
}
