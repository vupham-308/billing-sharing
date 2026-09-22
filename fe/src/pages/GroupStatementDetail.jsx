import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  Calendar,
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  AlertCircle,
  Clock,
  CheckCircle2,
  Receipt,
  User,
  ExternalLink,
} from "lucide-react";
import { statementApi, groupApi, paymentRequestApi } from "../services/api";

export default function GroupStatementDetail() {
  const { groupId } = useParams();

  const [group, setGroup] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [error, setError] = useState("");

  const [copiedField, setCopiedField] = useState(null);
  const [qrModalItem, setQrModalItem] = useState(null);
  const [qrModalUrl, setQrModalUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);

  useEffect(() => {
    async function loadGroupAndPeriods() {
      setLoading(true);
      setError("");
      try {
        const [grp, periodList] = await Promise.all([
          groupApi.getGroup(groupId),
          statementApi.getGroupStatements(groupId),
        ]);
        setGroup(grp);
        setPeriods(periodList || []);
        if (periodList && periodList.length > 0) {
          setSelectedPeriodId(periodList[0].id);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Không thể tải thông tin kỳ sao kê của nhóm.");
      } finally {
        setLoading(false);
      }
    }
    if (groupId) {
      loadGroupAndPeriods();
    }
  }, [groupId]);

  useEffect(() => {
    async function loadPeriodDetail() {
      if (!selectedPeriodId) return;
      setPeriodLoading(true);
      try {
        const detail = await statementApi.getStatementDetail(groupId, selectedPeriodId);
        setStatementData(detail);
      } catch (err) {
        setError(err.response?.data?.message || "Không thể tải chi tiết kỳ sao kê.");
      } finally {
        setPeriodLoading(false);
      }
    }
    loadPeriodDetail();
  }, [groupId, selectedPeriodId]);

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenQr = async (item) => {
    setQrModalItem(item);
    setQrModalUrl("");
    setQrLoading(true);
    try {
      if (item.requestId) {
        const qrRes = await paymentRequestApi.getQr(item.requestId);
        setQrModalUrl(qrRes.qrUrl);
      }
    } catch (err) {
      // Fallback
    } finally {
      setQrLoading(false);
    }
  };

  const snapshot = statementData?.snapshot;
  const items = snapshot?.items || [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to={`/billing-sharing`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại bảng chi tiêu</span>
          </Link>
          {group && (
            <span className="text-xs font-medium text-slate-500">
              Nhóm: <strong className="text-slate-800">{group.name}</strong>
            </span>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Header Card */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Lịch Sử Sao Kê Nhóm</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem lại báo cáo chốt công nợ bất biến nguyên bản qua các kỳ sao kê
              </p>
            </div>
          </div>

          {/* Period Selector */}
          {periods.length > 0 && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Chọn kỳ sao kê:</span>
              <select
                value={selectedPeriodId || ""}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 cursor-pointer w-full md:w-auto"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    Kỳ {p.periodNumber} ({new Date(p.startDate).toLocaleDateString("vi-VN")} - {new Date(p.endDate).toLocaleDateString("vi-VN")})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Period Content */}
        {loading || periodLoading ? (
          <div className="p-12 text-center text-slate-400">Đang nạp dữ liệu sao kê...</div>
        ) : periods.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium">Nhóm này chưa có kỳ sao kê nào được chốt.</p>
            <p className="text-xs text-slate-400 mt-1">Hệ thống sẽ tự động chốt sao kê vào 08:30 ngày đến hạn.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Period Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-medium block">Kỳ sao kê</span>
                <span className="text-lg font-bold text-slate-800 mt-0.5 block">
                  Kỳ số {statementData?.periodNumber}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  {new Date(statementData?.startDate).toLocaleDateString("vi-VN")} — {new Date(statementData?.endDate).toLocaleDateString("vi-VN")}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-medium block">Thời gian chốt thực tế</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">
                  {new Date(statementData?.processedAt).toLocaleString("vi-VN")}
                </span>
                <span className="text-xs text-emerald-600 mt-1 block font-medium">
                  Trạng thái: {statementData?.status}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-400 font-medium block">Tổng công nợ cần thanh toán</span>
                <span className="text-lg font-extrabold text-red-600 mt-0.5 block">
                  {Number(snapshot?.totalPendingAmount || 0).toLocaleString("vi-VN")} VND
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  {items.length} khoản nợ trong kỳ
                </span>
              </div>
            </div>

            {/* Snapshot Integrity Notice */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Bảo toàn lịch sử:</strong> Bảng sao kê dưới đây được phục hồi nguyên bản từ snapshot thời điểm chốt kỳ ({new Date(statementData?.processedAt).toLocaleDateString("vi-VN")}), không bị thay đổi bởi các giao dịch phát sinh sau này.
              </span>
            </div>

            {/* Debts Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Chi Tiết Các Khoản Nợ Trong Kỳ</h3>
                <span className="text-xs text-slate-500">{items.length} khoản</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Khoản chi tiêu</th>
                      <th className="px-4 py-3">Người nợ</th>
                      <th className="px-4 py-3">Người nhận</th>
                      <th className="px-4 py-3">Số tiền</th>
                      <th className="px-4 py-3">Thông tin tài khoản & Nội dung</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Không có khoản nợ nào trong kỳ này.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const isPending = item.status === "PENDING";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">
                              <p className="truncate" title={item.transactionTitle}>{item.transactionTitle}</p>
                              <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-sm ${
                                isPending ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {item.debtorName}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {item.creditorName}
                            </td>
                            <td className="px-4 py-3 font-bold text-red-600">
                              {Number(item.amount).toLocaleString("vi-VN")} VND
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              {item.accountNumber ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-slate-800 font-semibold">{item.accountNumber}</span>
                                    <span className="text-[11px] text-slate-500">({item.bankCode})</span>
                                    <button
                                      onClick={() => handleCopy(item.accountNumber, `acc-${idx}`)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                      title="Sao chép STK"
                                    >
                                      {copiedField === `acc-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">{item.accountHolderName}</p>
                                  <div className="flex items-center gap-1.5 text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">
                                    <span className="text-slate-500">ND:</span>
                                    <span className="font-mono font-bold text-slate-700 select-all">{item.description}</span>
                                    <button
                                      onClick={() => handleCopy(item.description, `desc-${idx}`)}
                                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                                      title="Sao chép nội dung"
                                    >
                                      {copiedField === `desc-${idx}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-amber-600 text-[11px]">Chưa thiết lập STK</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.accountNumber && (
                                  <button
                                    onClick={() => handleOpenQr(item)}
                                    className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem mã VietQR"
                                  >
                                    <QrCode className="w-4 h-4" />
                                  </button>
                                )}
                                {item.requestId && (
                                  <Link
                                    to={`/billing-sharing/payment-requests/${item.requestId}`}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Mở chi tiết yêu cầu"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </Link>
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
            </div>
          </div>
        )}

        {/* QR Modal */}
        {qrModalItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-900 text-sm">Mã VietQR Chuyển Tiền</h3>
                <button
                  onClick={() => setQrModalItem(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                {qrLoading ? (
                  <div className="py-12 text-xs text-slate-400">Đang sinh mã VietQR...</div>
                ) : qrModalUrl ? (
                  <img src={qrModalUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-lg shadow-xs" />
                ) : (
                  <div className="py-12 text-xs text-slate-400">Không thể tải mã VietQR</div>
                )}

                <div className="mt-3 text-xs space-y-1 text-slate-700">
                  <p className="font-bold text-red-600 text-sm">
                    {Number(qrModalItem.amount).toLocaleString("vi-VN")} VND
                  </p>
                  <p>Người nhận: <strong>{qrModalItem.creditorName}</strong></p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {qrModalItem.accountNumber} ({qrModalItem.bankCode})
                  </p>
                  <p className="text-[11px] font-mono bg-white p-1 rounded border border-slate-200">
                    ND: <strong>{qrModalItem.description}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQrModalItem(null)}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
