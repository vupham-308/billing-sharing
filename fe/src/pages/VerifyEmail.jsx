import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, ArrowLeft, Receipt, MailCheck, Send, RefreshCw } from "lucide-react";
import { authApi } from "../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState({ loading: false, message: "", error: "", countdown: 0 });

  const handleVerify = async () => {
    if (!token) {
      setError("Không tìm thấy mã xác thực trên liên kết. Vui lòng mở đúng đường dẫn trong email được gửi tới bạn.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await authApi.verifyEmail(token);
      setIsSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Không thể kích hoạt tài khoản. Liên kết có thể đã hết hạn (24 giờ) hoặc đã được sử dụng."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail || !resendEmail.includes("@")) {
      setResendStatus((prev) => ({ ...prev, error: "Vui lòng nhập địa chỉ email hợp lệ" }));
      return;
    }

    setResendStatus({ loading: true, message: "", error: "", countdown: 0 });
    try {
      const res = await authApi.resendVerification(resendEmail.trim());
      setResendStatus({
        loading: false,
        message: res.message || "Email kích hoạt mới đã được gửi! Vui lòng kiểm tra hộp thư của bạn.",
        error: "",
        countdown: 60,
      });

      // Bắt đầu đếm ngược 60s
      const timer = setInterval(() => {
        setResendStatus((prev) => {
          if (prev.countdown <= 1) {
            clearInterval(timer);
            return { ...prev, countdown: 0 };
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    } catch (err) {
      setResendStatus({
        loading: false,
        message: "",
        error: err.response?.data?.message || err.message || "Không thể gửi lại email kích hoạt lúc này.",
        countdown: 0,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/billing-sharing" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Billing Sharing</span>
              <span className="text-[10px] font-medium px-2 py-0.5 ml-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Xác thực tài khoản
              </span>
            </div>
          </Link>
          <Link
            to="/billing-sharing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 space-y-5">
          {isSuccess ? (
            <div className="text-center space-y-4 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Kích hoạt tài khoản thành công!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tài khoản của bạn đã được xác thực an toàn. Bây giờ bạn có thể đăng nhập và bắt đầu tạo nhóm, chia tiền và quản lý chi phí.
              </p>
              <button
                onClick={() => navigate("/billing-sharing")}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer mt-2"
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="text-center pb-1">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <MailCheck className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Xác nhận kích hoạt tài khoản
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Nhấn vào nút bên dưới để hoàn tất việc kích hoạt tài khoản Billing Sharing của bạn
                </p>
              </div>

              {error && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span>{error}</span>
                  </div>

                  {/* Form gửi lại email kích hoạt */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                    <p className="text-xs font-semibold text-slate-700">
                      Gửi lại email kích hoạt mới:
                    </p>
                    <form onSubmit={handleResend} className="space-y-2">
                      <input
                        type="email"
                        placeholder="Nhập địa chỉ email của bạn"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                      {resendStatus.message && (
                        <p className="text-[11px] text-emerald-600 font-medium">
                          {resendStatus.message}
                        </p>
                      )}
                      {resendStatus.error && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          {resendStatus.error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={resendStatus.loading || resendStatus.countdown > 0}
                        className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {resendStatus.loading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {resendStatus.countdown > 0
                            ? `Gửi lại sau (${resendStatus.countdown}s)`
                            : "Gửi lại liên kết kích hoạt"}
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {!token && !error && (
                <div className="p-3.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl leading-relaxed">
                  Không tìm thấy mã xác thực trên đường dẫn. Vui lòng mở lại liên kết được gửi trong email của bạn.
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={isSubmitting || !token}
                className="w-full py-3 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang kích hoạt...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận kích hoạt tài khoản</span>
                  </>
                )}
              </button>

              <div className="pt-1 text-center">
                <Link
                  to="/billing-sharing"
                  className="text-xs font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay về trang đăng nhập</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
