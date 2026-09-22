import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { KeyRound, Lock, CheckCircle2, AlertCircle, ArrowLeft, Receipt } from "lucide-react";
import { authApi } from "../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Thiếu mã xác thực (secret key). Vui lòng kiểm tra lại liên kết trong email.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không trùng khớp");
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({
        token,
        newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn (15 phút) hoặc đã được sử dụng."
      );
    } finally {
      setIsSubmitting(false);
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
                Đặt lại mật khẩu
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
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Đặt lại mật khẩu thành công!</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mật khẩu của bạn đã được cập nhật an toàn. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
              <button
                onClick={() => navigate("/billing-sharing")}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer mt-2"
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Tạo mật khẩu mới
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Vui lòng nhập mật khẩu mới để bảo vệ tài khoản Billing Sharing của bạn
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!token && (
                <div className="p-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">
                  Không tìm thấy mã xác thực trên đường dẫn. Vui lòng mở đúng liên kết trong email gửi từ hệ thống.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 mt-2 cursor-pointer"
              >
                {isSubmitting ? "Đang xử lý..." : "Cập nhật mật khẩu"}
              </button>

              <div className="pt-2 text-center">
                <Link
                  to="/billing-sharing"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  Quay lại đăng nhập
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
