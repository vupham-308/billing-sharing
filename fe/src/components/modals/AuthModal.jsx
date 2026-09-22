import React, { useState } from "react";
import { X, LogIn, UserPlus, AlertCircle, CreditCard, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { bankApi } from "../../services/api";

function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase();
}

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Bank Info for Register
  const [bankCode, setBankCode] = useState("MB");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isHolderTouched, setIsHolderTouched] = useState(false);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!isHolderTouched) {
      setAccountHolderName(removeVietnameseTones(val));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng điền đầy đủ email và mật khẩu");
      return;
    }

    if (isRegisterMode) {
      if (!name.trim()) {
        setError("Vui lòng nhập họ và tên của bạn");
        return;
      }
      if (!accountNumber.trim()) {
        setError("Vui lòng nhập số tài khoản ngân hàng để nhận tiền chuyển khoản");
        return;
      }
      if (!accountHolderName.trim()) {
        setError("Vui lòng nhập tên chủ tài khoản ngân hàng");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let res;
      if (isRegisterMode) {
        const selectedBank = VIETNAM_BANKS.find((b) => b.code === bankCode);
        const bankPayload = {
          bankCode,
          bankName: selectedBank?.name || bankCode,
          accountNumber: accountNumber.trim(),
          accountHolderName: accountHolderName.trim().toUpperCase(),
        };
        res = await register(name.trim(), email.trim(), password, bankPayload);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              {isRegisterMode ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {isRegisterMode ? "Đăng ký tài khoản Billing Sharing" : "Đăng nhập hệ thống"}
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
                onChange={handleNameChange}
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

          {/* Phần nhập STK Ngân hàng bắt buộc khi Đăng ký */}
          {isRegisterMode && (
            <div className="pt-3 border-t border-slate-100 space-y-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Tài khoản nhận tiền VietQR (Bắt buộc)</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Ngân hàng thụ hưởng
                </label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {VIETNAM_BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Số tài khoản ngân hàng
                </label>
                <input
                  type="text"
                  placeholder="VD: 0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ""))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
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
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  STK dùng để tự động tạo mã VietQR SePay nhận tiền từ các thành viên trong nhóm chi tiêu.
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 mt-2"
          >
            {isSubmitting
              ? "Đang xử lý..."
              : isRegisterMode
              ? "Tạo tài khoản & Bắt đầu"
              : "Đăng nhập"}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500">
            {isRegisterMode ? (
              <span>
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setIsRegisterMode(false);
                  }}
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
                  onClick={() => {
                    setError("");
                    setIsRegisterMode(true);
                  }}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  Đăng ký ngay
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
