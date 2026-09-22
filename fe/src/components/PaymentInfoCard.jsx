import React, { useState } from "react";
import { CreditCard, QrCode, Copy, Check, Edit3, ShieldCheck, ExternalLink } from "lucide-react";

export default function PaymentInfoCard({ paymentInfo, onOpenEditModal, onPreviewPersonalQr }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Tài khoản nhận tiền</h2>
            <p className="text-xs text-slate-500">Dùng để sinh mã VietQR SePay tự động</p>
          </div>
        </div>
        <button
          onClick={onOpenEditModal}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Chỉnh sửa thông tin tài khoản"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      {paymentInfo && paymentInfo.accountNumber ? (
        <div className="rounded-xl border border-slate-200 bg-linear-to-br from-slate-900 to-slate-800 text-white p-4 shadow-sm relative overflow-hidden">
          {/* Subtle watermark */}
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <CreditCard className="w-32 h-32" />
          </div>

          <div className="flex items-center justify-between mb-3 text-xs text-slate-300">
            <span className="font-semibold uppercase tracking-wider">{paymentInfo.bankCode}</span>
            <div className="flex items-center gap-1.5">
              {paymentInfo.hasSepayApiKey || paymentInfo.sepayApiKey ? (
                <span className="flex items-center gap-1 text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-medium border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>SePay Webhook Auto</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] bg-slate-700/60 px-2 py-0.5 rounded text-slate-300 font-medium">
                  <span>Duyệt thủ công</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] bg-slate-700/60 px-2 py-0.5 rounded text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Chính chủ</span>
              </span>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-mono tracking-widest font-semibold">
                {paymentInfo.accountNumber}
              </span>
              <button
                onClick={() => handleCopy(paymentInfo.accountNumber)}
                className="p-1 hover:bg-slate-700/80 rounded transition-colors text-slate-300 hover:text-white"
                title="Sao chép số tài khoản"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-slate-300 uppercase tracking-wide mt-0.5">
              {paymentInfo.accountHolderName}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">VietQR SePay tích hợp</span>
            <button
              onClick={onPreviewPersonalQr}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-white transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Xem QR</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center bg-slate-50/50">
          <CreditCard className="w-8 h-8 mx-auto mb-1.5 text-slate-400" />
          <p className="text-xs font-medium text-slate-700">Chưa cài đặt tài khoản ngân hàng</p>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-2.5">
            Cài đặt để các thành viên có thể quét mã VietQR chuyển tiền cho bạn
          </p>
          <button
            onClick={onOpenEditModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <span>+ Cài đặt STK ngay</span>
          </button>
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">Tự động duyệt tiền vào?</span>
        <a
          href="/billing-sharing/guides/sepay-setup"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <span>Hướng dẫn thiết lập SePay</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </section>
  );
}
