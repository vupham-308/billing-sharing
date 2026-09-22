import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  RefreshCw,
  Search,
  RotateCcw,
  Ban,
  Eye,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  XCircle,
  FileText,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { adminOutboxApi } from "../services/api";

const STATUS_BADGES = {
  PENDING: { bg: "bg-slate-100 text-slate-700 border-slate-200", label: "Chờ gửi", icon: Clock },
  PROCESSING: { bg: "bg-blue-100 text-blue-700 border-blue-200", label: "Đang gửi", icon: RefreshCw },
  SENT: { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Đã gửi", icon: CheckCircle2 },
  RETRY_PENDING: { bg: "bg-amber-100 text-amber-700 border-amber-200", label: "Chờ thử lại", icon: Clock },
  FAILED_PERMANENT: { bg: "bg-red-100 text-red-700 border-red-200", label: "Thất bại", icon: XCircle },
  UNKNOWN: { bg: "bg-purple-100 text-purple-700 border-purple-200", label: "Không xác định", icon: HelpCircle },
  SKIPPED: { bg: "bg-gray-100 text-gray-600 border-gray-200", label: "Đã bỏ qua", icon: Ban },
  CANCELLED: { bg: "bg-slate-200 text-slate-500 border-slate-300", label: "Đã hủy", icon: Ban },
};

export default function AdminOutbox() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [outboxes, setOutboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [selectedItem, setSelectedItem] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchOutboxes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        size: 15,
        sortBy: "createdAt",
        direction: "desc",
      };
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      if (search.trim()) params.search = search.trim();

      const data = await adminOutboxApi.getOutboxList(params);
      setOutboxes(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách outbox");
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterType, search]);

  useEffect(() => {
    if (user && user.role !== "ADMIN") {
      navigate("/billing-sharing");
      return;
    }
    fetchOutboxes();
  }, [user, navigate, fetchOutboxes]);

  const handleManualRetry = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn gửi lại email này?")) return;
    setActionLoadingId(id);
    setSuccessMsg("");
    setError("");
    try {
      await adminOutboxApi.retryOutbox(id);
      setSuccessMsg("Đã kích hoạt gửi lại email thành công!");
      fetchOutboxes();
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi gửi lại email");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy gửi email này?")) return;
    setActionLoadingId(id);
    setSuccessMsg("");
    setError("");
    try {
      await adminOutboxApi.cancelOutbox(id);
      setSuccessMsg("Đã hủy gửi email thành công!");
      fetchOutboxes();
    } catch (err) {
      setError(err.response?.data?.message || "Lỗi khi hủy gửi email");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Quản Trị Email Outbox</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                  {totalElements} bản ghi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Đối soát trạng thái gửi mail, xử lý timeout UNKNOWN và gửi lại có kiểm soát
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={fetchOutboxes}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Tải lại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Làm mới</span>
            </button>
            <Link
              to="/billing-sharing"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về trang người dùng</span>
            </Link>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo email, tên người nhận hoặc tiêu đề..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium text-slate-700 cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">PENDING (Chờ gửi)</option>
              <option value="PROCESSING">PROCESSING (Đang gửi)</option>
              <option value="SENT">SENT (Đã gửi)</option>
              <option value="RETRY_PENDING">RETRY_PENDING (Chờ retry 14h)</option>
              <option value="UNKNOWN">UNKNOWN (Socket Read Timeout)</option>
              <option value="FAILED_PERMANENT">FAILED_PERMANENT (Lỗi vĩnh viễn)</option>
              <option value="SKIPPED">SKIPPED (Bỏ qua)</option>
              <option value="CANCELLED">CANCELLED (Đã hủy)</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-medium text-slate-700 cursor-pointer"
            >
              <option value="">Tất cả loại email</option>
              <option value="INVOICE_DIGEST">INVOICE_DIGEST (08:00)</option>
              <option value="STATEMENT">STATEMENT (08:30)</option>
              <option value="DEBT_REMINDER">DEBT_REMINDER (09:00)</option>
              <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
              <option value="PAYMENT_APPROVED">PAYMENT_APPROVED</option>
              <option value="PAYMENT_REJECTED">PAYMENT_REJECTED</option>
              <option value="PASSWORD_RESET">PASSWORD_RESET</option>
              <option value="EMAIL_VERIFICATION">EMAIL_VERIFICATION</option>
              <option value="PASSWORD_CHANGED">PASSWORD_CHANGED</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Loại / Tiêu đề</th>
                  <th className="px-4 py-3">Người nhận</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Retry</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outboxes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      {loading ? "Đang tải dữ liệu..." : "Không có bản ghi email outbox nào phù hợp."}
                    </td>
                  </tr>
                ) : (
                  outboxes.map((item) => {
                    const statusInfo = STATUS_BADGES[item.status] || STATUS_BADGES.PENDING;
                    const StatusIcon = statusInfo.icon;
                    const canRetry =
                      item.status === "UNKNOWN" ||
                      item.status === "FAILED_PERMANENT" ||
                      item.status === "RETRY_PENDING";
                    const canCancel = item.status !== "SENT" && item.status !== "CANCELLED";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 max-w-[240px]">
                          <span className="font-bold text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 block w-fit mb-1">
                            {item.type}
                          </span>
                          <p className="font-medium text-slate-800 truncate" title={item.subject}>
                            {item.subject}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono truncate block" title={item.businessKey}>
                            {item.businessKey}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{item.recipientName || "—"}</p>
                          <p className="text-slate-500 font-mono text-[11px]">{item.recipientEmail}</p>
                          {item.deliveryStatus && (
                            <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-blue-50 text-blue-700 border border-blue-200">
                              Brevo: {item.deliveryStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusInfo.label}</span>
                          </span>
                          {item.lastError && (
                            <p className="text-[10px] text-red-600 mt-1 line-clamp-1 max-w-[160px]" title={item.lastError}>
                              {item.lastError}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">
                            <span className="font-bold">{item.retryCount}</span>
                            <span className="text-slate-400"> / {item.maxRetries}</span>
                          </div>
                          {item.nextRetryAt && (
                            <p className="text-[10px] text-slate-500 mt-0.5" title={item.nextRetryAt}>
                              Hẹn: {new Date(item.nextRetryAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500">
                          <p title={item.createdAt}>
                            {new Date(item.createdAt).toLocaleDateString("vi-VN")}{" "}
                            {new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {item.processedAt && (
                            <p className="text-[10px] text-emerald-600" title={item.processedAt}>
                              Xong: {new Date(item.processedAt).toLocaleTimeString("vi-VN")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canRetry && (
                              <button
                                onClick={() => handleManualRetry(item.id)}
                                disabled={actionLoadingId === item.id}
                                className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Gửi lại (Manual Retry)"
                              >
                                <RotateCcw className={`w-4 h-4 ${actionLoadingId === item.id ? "animate-spin" : ""}`} />
                              </button>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => handleCancel(item.id)}
                                disabled={actionLoadingId === item.id}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="Hủy gửi"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Trang {page + 1} / {totalPages} (Tổng {totalElements} email)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Modal */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-600" />
                  <h3 className="font-bold text-slate-900 text-base">Chi Tiết Email Outbox</h3>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block">ID:</span>
                    <span className="font-mono text-slate-700 select-all">{selectedItem.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Loại Email:</span>
                    <span className="font-bold text-slate-800">{selectedItem.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Người nhận:</span>
                    <span className="font-medium text-slate-800">
                      {selectedItem.recipientName} &lt;{selectedItem.recipientEmail}&gt;
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Trạng thái:</span>
                    <span className="font-bold text-purple-700">{selectedItem.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Business Key:</span>
                    <span className="font-mono text-slate-700 select-all">{selectedItem.businessKey}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Brevo Message ID:</span>
                    <span className="font-mono text-slate-700 select-all">
                      {selectedItem.providerMessageId || "Chưa có"}
                    </span>
                  </div>
                </div>

                {selectedItem.lastError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                    <span className="font-bold block mb-1">Lỗi ghi nhận gần nhất (Last Error):</span>
                    <p className="font-mono text-[11px] whitespace-pre-wrap">{selectedItem.lastError}</p>
                  </div>
                )}

                {selectedItem.payloadJson && (
                  <div>
                    <span className="font-bold text-slate-700 block mb-1">Payload JSON (Dùng cho Just-In-Time check):</span>
                    <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedItem.payloadJson), null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <span className="font-bold text-slate-700 block mb-1">Nội dung HTML:</span>
                  <div
                    className="p-4 rounded-xl border border-slate-200 max-h-60 overflow-y-auto bg-white"
                    dangerouslySetInnerHTML={{ __html: selectedItem.htmlContent }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
