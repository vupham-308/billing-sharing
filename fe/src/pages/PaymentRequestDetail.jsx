import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  QrCode,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { paymentRequestApi } from "../services/api";

export default function PaymentRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [copiedField, setCopiedField] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await paymentRequestApi.getDetail(id);
      setRequest(data);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải thông tin yêu cầu thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDetail();
    }
  }, [id]);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPaid = async () => {
    if (!window.confirm("Bạn xác nhận đã chuyển tiền thành công cho chủ nợ?")) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      await paymentRequestApi.confirmPaid(id);
      setSuccessMsg("Đã xác nhận chuyển tiền thành công! Hệ thống đã gửi thông báo đến chủ nợ để duyệt.");
      fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi xác nhận chuyển tiền");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm("Bạn xác nhận đã nhận được tiền từ người nợ?")) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      await paymentRequestApi.approve(id);
      setSuccessMsg("Đã duyệt nhận tiền thành công! Khoản nợ đã được đánh dấu hoàn tất.");
      fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi duyệt nhận tiền");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!window.confirm("Bạn có chắc muốn từ chối yêu cầu thanh toán này và yêu cầu người nợ chuyển lại?")) return;
    setActionLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      await paymentRequestApi.reject(id);
      setSuccessMsg("Đã từ chối xác nhận nhận tiền. Khoản nợ đã chuyển về trạng thái PENDING.");
      fetchDetail();
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi từ chối thanh toán");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center text-slate-500 text-sm">Đang tải thông tin yêu cầu thanh toán...</div>
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-200 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Không thể truy cập</h2>
          <p className="text-xs text-slate-600">{error}</p>
          <Link
            to="/billing-sharing"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    );
  }

  const isDebtor = user?.id === request.debtor?.id;
  const isCreditor = user?.id === request.creditor?.id;
  const isAdmin = user?.role === "ADMIN";

  const isPending = request.status === "PENDING";
  const isWaitingApprove = request.status === "WAITING_APPROVE";
  const isCompleted = request.status === "COMPLETED";

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/billing-sharing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại bảng chi tiêu</span>
          </Link>
          <div className="flex items-center gap-2">
            {request.identify && (
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                {request.identify}
              </span>
            )}
            <span className="text-xs font-mono text-slate-400">ID: {request.id.slice(0, 8)}</span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200 block">
              Chi Tiết Yêu Cầu Thanh Toán
            </span>
            <h1 className="text-xl font-bold mt-1">{request.transactionTitle || "Chi tiêu chia sẻ"}</h1>
            <div className="mt-3">
              <span className="text-3xl font-extrabold">{Number(request.amount).toLocaleString("vi-VN")} VND</span>
              {request.breakdown && request.breakdown.nettedCredit > 0 && (
                <div className="text-xs text-indigo-100 mt-1 font-medium">
                  ✨ Đã cấn trừ 2 chiều: Nợ gốc {Number(request.breakdown.grossDebt).toLocaleString("vi-VN")} VND - Khấu trừ {Number(request.breakdown.nettedCredit).toLocaleString("vi-VN")} VND
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              {isPending && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-200 border border-amber-300/30">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Chờ chuyển tiền (PENDING)</span>
                </span>
              )}
              {isWaitingApprove && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-200 border border-blue-300/30">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Chờ chủ nợ xác nhận (WAITING_APPROVE)</span>
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-300/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Đã thanh toán hoàn tất (COMPLETED)</span>
                </span>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-5">
            {/* Participants */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Người cần chuyển (Người nợ):</span>
                <span className="font-bold text-slate-800 text-sm">{request.debtor?.fullName}</span>
                <p className="text-[11px] text-slate-500">{request.debtor?.email}</p>
              </div>
              <div>
                <span className="text-slate-400 block">Người nhận tiền (Chủ nợ):</span>
                <span className="font-bold text-slate-800 text-sm">{request.creditor?.fullName}</span>
                <p className="text-[11px] text-slate-500">{request.creditor?.email}</p>
              </div>
            </div>

            {/* Netting Breakdown Section */}
            {request.breakdown && (
              <div className="p-4 bg-sky-50/70 rounded-xl border border-sky-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sky-950 text-sm flex items-center gap-1.5">
                    ✨ Bảng giải trình cấn trừ bù trừ 2 chiều
                  </h3>
                  <span className="text-[11px] text-sky-700 font-semibold px-2 py-0.5 bg-sky-100 rounded-md">
                    Pairwise Netting
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 bg-white rounded-lg border border-sky-100 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Khoản nợ gốc</span>
                    <span className="font-bold text-rose-600 text-sm">
                      {Number(request.breakdown.grossDebt).toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Nợ cấn trừ</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      -{Number(request.breakdown.nettedCredit).toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Thực chuyển</span>
                    <span className="font-bold text-indigo-600 text-sm">
                      {Number(request.breakdown.netAmount).toLocaleString("vi-VN")} VND
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-sky-100/60 rounded-md font-mono text-[11px] text-slate-700 text-center">
                  <strong>Công thức:</strong> {request.breakdown.formula}
                </div>

                {/* Details Breakdown */}
                <div className="space-y-3 pt-1">
                  <div>
                    <span className="font-semibold text-rose-700 block mb-1">
                      1. Các khoản chi tiêu {request.debtor?.fullName} nợ {request.creditor?.fullName}:
                    </span>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                      {request.breakdown.debtItems?.length > 0 ? (
                        request.breakdown.debtItems.map((item, idx) => (
                          <div key={idx} className="p-2 flex justify-between items-center text-[11px]">
                            <span className="font-medium text-slate-800">{item.transactionTitle}</span>
                            <span className="font-bold text-rose-600">+{Number(item.amount).toLocaleString("vi-VN")} VND</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-slate-400 text-center">Không có chi tiết</div>
                      )}
                    </div>
                  </div>

                  {request.breakdown.nettedItems && request.breakdown.nettedItems.length > 0 && (
                    <div>
                      <span className="font-semibold text-emerald-700 block mb-1">
                        2. Các khoản đối phương ({request.creditor?.fullName}) nợ lại bạn (đã được khấu trừ):
                      </span>
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {request.breakdown.nettedItems.map((item, idx) => (
                          <div key={idx} className="p-2 flex justify-between items-center text-[11px]">
                            <span className="font-medium text-slate-800">{item.transactionTitle}</span>
                            <span className="font-bold text-emerald-600">-{Number(item.amount).toLocaleString("vi-VN")} VND</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Note & Description */}
            <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-400 block">Ghi chú giao dịch:</span>
              <p className="font-medium text-slate-800">{request.note || "Không có ghi chú"}</p>
            </div>

            {/* QR Code & Banking Section (If Pending or Waiting) */}
            {(isPending || isWaitingApprove) && request.qrUrl && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Mã VietQR Thanh Toán</span>
                <img
                  src={request.qrUrl}
                  alt="VietQR"
                  className="w-52 h-52 mx-auto rounded-lg shadow-xs border border-slate-200"
                />
                <p className="text-[11px] text-slate-500">
                  Mở ứng dụng ngân hàng và quét mã để tự động điền đúng số tiền và nội dung chuyển khoản.
                </p>
              </div>
            )}

            {/* Context Messages based on User Role and Status */}
            {isWaitingApprove && isDebtor && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Bạn đã bấm xác nhận chuyển tiền. Đang chờ chủ nợ <strong>{request.creditor?.fullName}</strong> kiểm tra tài khoản và duyệt. <strong>Bạn không cần chuyển tiền lại</strong>.
                </span>
              </div>
            )}

            {isWaitingApprove && isCreditor && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Người nợ <strong>{request.debtor?.fullName}</strong> đã báo đã chuyển khoản. Vui lòng kiểm tra tài khoản ngân hàng và chọn <strong>Duyệt</strong> hoặc <strong>Từ chối</strong> bên dưới.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {isPending && (isDebtor || isAdmin) && (
                <button
                  onClick={handleConfirmPaid}
                  disabled={actionLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLoading ? "Đang xử lý..." : "Tôi đã chuyển tiền"}</span>
                </button>
              )}

              {isWaitingApprove && (isCreditor || isAdmin) && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Duyệt nhận tiền</span>
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Từ chối</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
