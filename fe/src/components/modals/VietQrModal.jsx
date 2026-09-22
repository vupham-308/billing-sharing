import React, { useEffect, useState } from "react";
import { X, QrCode, Copy, Check, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { formatVND } from "../../utils/formatters";

export default function VietQrModal({ isOpen, onClose, qrData, onConfirmPaid, onRefreshStatus }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [qrLoadError, setQrLoadError] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(qrData?.status || null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isPersonalQr = qrData?.mode === "PERSONAL";
  const paymentRequestId = isPersonalQr ? null : (qrData?.paymentRequestId || qrData?.id);

  useEffect(() => {
    setCopiedKey(null);
    setCopyError("");
    setQrLoadError(false);
    setCurrentStatus(qrData?.status || null);
    setShowBreakdown(false);
  }, [qrData?.id, qrData?.qrUrl, qrData?.status, isOpen]);

  // SePay có thể tự hoàn tất trong lúc modal đang mở. Cập nhật trạng thái nhẹ nhàng mỗi 5 giây.
  useEffect(() => {
    if (!isOpen || isPersonalQr || !paymentRequestId || !onRefreshStatus || currentStatus === "COMPLETED") {
      return undefined;
    }

    let active = true;
    const refreshStatus = async () => {
      try {
        const detail = await onRefreshStatus(paymentRequestId);
        if (active && detail?.status) setCurrentStatus(detail.status);
      } catch {
        // Giữ trạng thái hiện tại và thử lại ở lần polling tiếp theo.
      }
    };

    const intervalId = window.setInterval(refreshStatus, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, isPersonalQr, paymentRequestId, onRefreshStatus, currentStatus]);

  if (!isOpen || !qrData) return null;

  const qrUrl = qrData.qrUrl;
  const status = currentStatus || qrData.status;
  const isPending = !isPersonalQr && status === "PENDING";
  const isWaiting = !isPersonalQr && status === "WAITING_APPROVE";
  const isCompleted = !isPersonalQr && status === "COMPLETED";

  const handleCopy = async (key, value) => {
    if (value === null || value === undefined || value === "") return;
    setCopyError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(String(value));
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopyError("Không thể sao chép. Vui lòng chọn và sao chép thủ công.");
    }
  };

  const handleConfirm = async () => {
    if (isPersonalQr || !paymentRequestId || !isPending || !onConfirmPaid) return;
    setIsSubmitting(true);
    try {
      await onConfirmPaid(paymentRequestId);
      onClose();
    } catch {
      // Giữ modal mở để người dùng thấy lỗi và thử lại.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">
              {isPersonalQr ? "Mã QR nhận tiền cá nhân" : "Mã thanh toán VietQR"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Đóng mã QR"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
            {qrUrl && !qrLoadError ? (
              <img
                src={qrUrl}
                alt={isPersonalQr ? "VietQR nhận tiền cá nhân" : "VietQR thanh toán"}
                className="w-56 h-auto object-contain rounded-lg shadow-xs border border-slate-200 bg-white"
                onError={() => setQrLoadError(true)}
              />
            ) : (
              <div role="alert" className="w-full py-12 text-center text-sm text-rose-600">
                Không thể tải mã QR. Vui lòng đóng cửa sổ và thử lại.
              </div>
            )}
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              {isPersonalQr
                ? "Mở app ngân hàng để quét mã và nhập số tiền cần nhận."
                : "Mở app ngân hàng bất kỳ để quét mã QR chuyển khoản chuẩn VietQR SePay."}
            </p>
          </div>

          {!isPersonalQr && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-900">
              <div className="font-semibold">{qrData.transactionTitle || "Khoản thanh toán"}</div>
              {qrData.groupName && <div className="mt-0.5 text-indigo-700">Nhóm: {qrData.groupName}</div>}
              {qrData.creditorName && <div className="mt-0.5 text-indigo-700">Người nhận: {qrData.creditorName}</div>}
            </div>
          )}

          {!isPersonalQr && qrData.breakdown && qrData.breakdown.nettedCredit > 0 && (
            <div className="p-3 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 inline-flex items-center gap-1 text-xs">
                  ✨ Cấn trừ nợ chéo 2 chiều
                </span>
                <button
                  type="button"
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold underline"
                >
                  {showBreakdown ? "Ẩn bớt" : "Chi tiết"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-1.5 px-2 bg-white rounded-lg border border-sky-100">
                <div>
                  <span className="text-[10px] text-slate-400 block">NỢ GỐC</span>
                  <span className="font-semibold text-rose-600">{formatVND(qrData.breakdown.grossDebt)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">CẤN TRỪ</span>
                  <span className="font-semibold text-emerald-600">-{formatVND(qrData.breakdown.nettedCredit)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">THỰC CHUYỂN</span>
                  <span className="font-bold text-indigo-600">{formatVND(qrData.breakdown.netAmount)}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 font-mono bg-sky-100/50 p-1.5 rounded text-center">
                {qrData.breakdown.formula}
              </div>

              {showBreakdown && (
                <div className="pt-2 border-t border-sky-200/60 space-y-1.5 text-[11px]">
                  <div className="font-semibold text-rose-700">Các khoản bạn nợ:</div>
                  {qrData.breakdown.debtItems?.map((d, i) => (
                    <div key={i} className="flex justify-between pl-2 text-slate-600">
                      <span>• {d.transactionTitle}</span>
                      <span className="font-medium">{formatVND(d.amount)}</span>
                    </div>
                  ))}
                  <div className="font-semibold text-emerald-700 pt-1">Các khoản đối phương nợ lại (khấu trừ):</div>
                  {qrData.breakdown.nettedItems?.map((n, i) => (
                    <div key={i} className="flex justify-between pl-2 text-slate-600">
                      <span>• {n.transactionTitle}</span>
                      <span className="font-medium">-{formatVND(n.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">NGÂN HÀNG & STK</span>
                <span className="font-bold text-slate-900 text-sm">
                  {qrData.bankCode} - {qrData.accountNumber}
                </span>
                <span className="block text-slate-600 text-[11px] uppercase">{qrData.accountHolderName}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("acc", qrData.accountNumber)}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Sao chép STK"
                aria-label="Sao chép số tài khoản"
              >
                {copiedKey === "acc" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px]">
                  {isPersonalQr ? "SỐ TIỀN (NHẬP TRÊN APP NGÂN HÀNG)" : "SỐ TIỀN THANH TOÁN"}
                </span>
                <span className="font-extrabold text-indigo-600 text-base">
                  {isPersonalQr ? "Nhập trên app ngân hàng" : formatVND(qrData.amount)}
                </span>
              </div>
              {!isPersonalQr && (
                <button
                  type="button"
                  onClick={() => handleCopy("amount", qrData.amount)}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                  title="Sao chép số tiền"
                  aria-label="Sao chép số tiền"
                >
                  {copiedKey === "amount" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="pr-2">
                <span className="text-slate-400 block text-[10px]">NỘI DUNG CHUYỂN TIỀN</span>
                <span className="font-medium text-slate-800 text-xs break-all font-mono">{qrData.description}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy("des", qrData.description)}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0"
                title="Sao chép nội dung chuyển khoản"
                aria-label="Sao chép nội dung chuyển khoản"
              >
                {copiedKey === "des" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copyError && <p role="alert" className="text-xs text-rose-600">{copyError}</p>}
            <button
              type="button"
              onClick={() => handleCopy(
                "all",
                [
                  `Ngan hang: ${qrData.bankCode}`,
                  `So tai khoan: ${qrData.accountNumber}`,
                  `Nguoi nhan: ${qrData.accountHolderName}`,
                  !isPersonalQr ? `So tien: ${qrData.amount}` : null,
                  `Noi dung: ${qrData.description}`,
                ].filter(Boolean).join("\n")
              )}
              className="w-full py-2 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold text-xs transition-colors"
            >
              {copiedKey === "all" ? "Đã sao chép thông tin" : "Sao chép toàn bộ thông tin chuyển khoản"}
            </button>

            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Lưu ý:</strong>{" "}
                {isPersonalQr
                  ? "Đây là QR nhận tiền cá nhân, không gắn với một khoản nợ cụ thể."
                  : "Giữ nguyên nội dung chuyển khoản để hệ thống SePay tự động khớp giao dịch."}
              </span>
            </div>
          </div>

          {!isPersonalQr && (
            <div className="pt-2">
              {isPending && (
                <>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isSubmitting || !qrUrl}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-all disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? "Đang xử lý..." : "Tôi đã chuyển khoản xong"}</span>
                  </button>
                  <p className="text-[11px] text-center text-slate-500 mt-2">
                    Chỉ xác nhận sau khi bạn đã thực hiện chuyển khoản. Chủ nợ sẽ nhận thông báo để kiểm tra và duyệt.
                  </p>
                </>
              )}
              {isWaiting && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4" /> Khoản này đang chờ chủ nợ kiểm tra và duyệt nhận tiền.
                </div>
              )}
              {isCompleted && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Khoản thanh toán này đã được hoàn tất.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
