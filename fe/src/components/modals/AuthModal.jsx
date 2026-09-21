import React, { useState } from "react";
import { X, LogIn, UserPlus, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, setIsDemo, setUser, DEMO_USER } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng điền đầy đủ email và mật khẩu");
      return;
    }
    if (isRegisterMode && !name.trim()) {
      setError("Vui lòng nhập họ và tên của bạn");
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (isRegisterMode) {
        res = await register(name.trim(), email.trim(), password);
      } else {
        res = await login(email.trim(), password);
      }

      if (res.success) {
        onClose();
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError(err.message || "Xác thực thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDemo = () => {
    setIsDemo(true);
    setUser(DEMO_USER);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {isRegisterMode ? "Đăng ký tài khoản" : "Đăng nhập hệ thống"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Họ và tên
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn Nam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

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

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting
              ? "Đang xử lý..."
              : isRegisterMode
              ? "Tạo tài khoản"
              : "Đăng nhập"}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500">
            {isRegisterMode ? (
              <span>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(false)}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  Đăng nhập
                </button>
              </span>
            ) : (
              <span>
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(true)}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  Đăng ký ngay
                </button>
              </span>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleUseDemo}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tiếp tục trải nghiệm ở chế độ Demo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
