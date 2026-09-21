import React, { useState, useEffect } from "react";
import { X, CreditCard, ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react";
import { bankApi } from "../../services/api";
import BankSelect from "../common/BankSelect";

function removeVietnameseTones(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase();
}

export default function PaymentInfoModal({ isOpen, onClose, currentInfo, onSave, isForceSetup = false }) {
  const [banks, setBanks] = useState([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [bankCode, setBankCode] = useState(currentInfo?.bankCode || "");
  const [accountNumber, setAccountNumber] = useState(currentInfo?.accountNumber || "");
  const [accountHolderName, setAccountHolderName] = useState(currentInfo?.accountHolderName || "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nạp danh sách ngân hàng từ Database API
  useEffect(() => {
    let isCancelled = false;
    async function loadBanks() {
      setIsLoadingBanks(true);
      try {
        const data = await bankApi.getBanks();
        if (!isCancelled && Array.isArray(data)) {
          setBanks(data);
          if (data.length > 0) {
            setBankCode((prev) => prev || currentInfo?.bankCode || data[0].code);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải danh sách ngân hàng:", err);
      } finally {
        if (!isCancelled) setIsLoadingBanks(false);
      }
    }
    if (isOpen) {
      loadBanks();
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, currentInfo]);

  useEffect(() => {
    if (currentInfo) {
      setBankCode(currentInfo.bankCode || "");
      setAccountNumber(currentInfo.accountNumber || "");
      setAccountHolderName(currentInfo.accountHolderName || "");
    }
  }, [currentInfo, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!accountNumber.trim()) {
      setError("Vui lòng nhập số tài khoản ngân hàng");
      return;
    }
    if (!accountHolderName.trim()) {
      setError("Vui lòng nhập tên chủ tài khoản");
      return;
    }

    const selectedBank = banks.find((b) => b.code === bankCode);

    setIsSubmitting(true);
    try {
      await onSave({
        bankCode,
        bankName: selectedBank?.name || bankCode,
        accountNumber: accountNumber.trim(),
        accountHolderName: accountHolderName.trim().toUpperCase(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Không thể cập nhật thông tin thanh toán.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={isForceSetup ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {isForceSetup ? "Yêu cầu cài đặt tài khoản nhận tiền" : "Cài đặt tài khoản nhận tiền"}
              </h3>
              {isForceSetup && (
                <p className="text-[11px] text-amber-600 font-medium">Bắt buộc để bắt đầu sử dụng</p>
              )}
            </div>
          </div>
          {!isForceSetup && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Force Setup Alert */}
        {isForceSetup && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Chưa có thông tin nhận tiền</span>
              <span>
                Vui lòng nhập tài khoản ngân hàng của bạn để các thành viên có thể quét mã VietQR thanh toán tiền chi tiêu cho bạn.
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

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
                placeholder="VD: NGUYEN VAN A"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(removeVietnameseTones(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Thông tin tài khoản chỉ dùng để sinh mã VietQR SePay cho bạn bè chuyển tiền trả bạn, hoàn toàn bảo mật.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            {!isForceSetup && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all disabled:opacity-50 ${
                isForceSetup ? "w-full" : "px-5"
              }`}
            >
              {isSubmitting ? "Đang lưu..." : isForceSetup ? "Hoàn tất cài đặt để tiếp tục" : "Lưu thông tin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
