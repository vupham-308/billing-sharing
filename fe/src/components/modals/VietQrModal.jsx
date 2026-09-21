import React, { useState } from "react";
import { X, QrCode, Copy, Check, CheckCircle2, AlertCircle } from "lucide-react";
import { formatVND } from "../../utils/formatters";

export default function VietQrModal({ isOpen, onClose, qrData, onConfirmPaid }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !qrData) return null;

  const handleCopy = (key, text) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmPaid(qrData.paymentRequestId || qrData.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate VietQR URL fallback if not provided
  const qrUrl =
    qrData.qrUrl ||
    `https://vietqr.app/img?acc=${qrData.accountNumber || "0123456789"}&bank=${
      qrData.bankCode || "MB"
    }&amount=${qrData.amount || 0}&des=${encodeURIComponent(
      qrData.description || "Thanh toan tien bill"
    )}&template=compact&holder=${encodeURIComponent(qrData.accountHolderName || "")}`;



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Mã thanh toán VietQR</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* QR Container */}
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <img
              src={qrUrl}
              alt="VietQR SePay"
              className="w-56 h-auto object-contain rounded-lg shadow-xs border border-slate-200 bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-2">
              Mở app ngân hàng bất kỳ để quét mã QR chuyển khoản chuẩn VietQR SePay
            </p>
          </div>

          {/* Copyable Details */}
          <div className="space-y-2.5 text-xs">
            {/* Bank & Account */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">NGÂN HÀNG & STK</span>
                <span className="font-bold text-slate-900 text-sm">
                  {qrData.bankCode || "MBBank"} - {qrData.accountNumber || "0123456789"}
                </span>
                <span className="block text-slate-600 text-[11px] uppercase">
                  {qrData.accountHolderName || "NGUYEN VAN A"}
                </span>
              </div>
              <button
                onClick={() => handleCopy("acc", qrData.accountNumber)}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Sao chép STK"
              >
                {copiedKey === "acc" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">SỐ TIỀN THANH TOÁN</span>
                <span className="font-extrabold text-indigo-600 text-base">
                  {formatVND(qrData.amount)}
                </span>
              </div>
              <button
                onClick={() => handleCopy("amount", qrData.amount)}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Sao chép số tiền"
              >
                {copiedKey === "amount" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Description */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="pr-2">
                <span className="text-slate-400 block text-[10px]">NỘI DUNG CHUYỂN TIỀN</span>
                <span className="font-medium text-slate-800 text-xs break-all">
                  {qrData.description || "Thanh toan tien bill"}
                </span>
              </div>
              <button
                onClick={() => handleCopy("des", qrData.description || "Thanh toan tien bill")}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
                title="Sao chép nội dung"
              >
                {copiedKey === "des" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Đang xử lý..." : "Tôi đã chuyển khoản xong"}</span>
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Sau khi bạn xác nhận, đối phương sẽ nhận được thông báo để duyệt đã nhận tiền.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
