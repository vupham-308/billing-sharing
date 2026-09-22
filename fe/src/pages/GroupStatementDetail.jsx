import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FileText,
  Calendar,
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  AlertCircle,
  CheckCircle2,
  Receipt,
  ExternalLink,
  Wallet,
  Users,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { statementApi, groupApi, paymentRequestApi } from "../services/api";
import { formatVND } from "../utils/formatters";
import { useAuth } from "../context/AuthContext";

export default function GroupStatementDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
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
        const [grp, periodList, groupsList] = await Promise.all([
          groupApi.getGroup(groupId),
          statementApi.getGroupStatements(groupId),
          groupApi.getGroups().catch(() => []),
        ]);
        setGroup(grp);
        setAllGroups(groupsList || []);
        setPeriods(periodList || []);
        if (periodList && periodList.length > 0) {
          setSelectedPeriodId(periodList[0].id);
        } else {
          setSelectedPeriodId(null);
          setStatementData(null);
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
    if (!text) return;
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
  const snapshotItems = snapshot?.items || [];
  const transactions = statementData?.transactions || [];
  const userSummary = statementData?.userSummary || {};

  const myPaymentRequests = userSummary.paymentRequestsToPay || userSummary.paymentRequests || [];
  const incomingPayments = userSummary.paymentRequestsToReceive || [];
  const totalToTransfer = userSummary.totalToTransfer || 0;
  const totalToReceive = userSummary.totalToReceive || 0;
  const userTotalShare = userSummary.userTotalShare ?? userSummary.userGrossDebt ?? 0;
  const userTotalPaid = userSummary.userTotalPaid ?? 0;
  const userPaidForOthers = userSummary.userPaidForOthers ?? userSummary.userGrossCredit ?? 0;
  const userOwesOthers = userSummary.userOwesOthers ?? 0;
  const userGrossDebt = userTotalShare;
  const userGrossCredit = userPaidForOthers;

  // Tính tổng các khoản chi tiêu trong kỳ
  const totalPeriodExpense = transactions.reduce((sum, tx) => sum + (tx.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Group Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Link
            to="/billing-sharing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại trang chủ</span>
          </Link>

          {allGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Đổi nhóm:</span>
              <select
                value={groupId}
                onChange={(e) => navigate(`/billing-sharing/groups/${e.target.value}/statements`)}
                className="px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                {allGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Kỳ Sao Kê Nhóm</h1>
                {group && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {group.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem lại báo cáo chốt công nợ bất biến, chi tiết từng hóa đơn và số tiền cần chuyển
              </p>
            </div>
          </div>

          {/* Period Selector */}
          {periods.length > 0 && (
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-semibold text-slate-600 shrink-0">Kỳ sao kê:</span>
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
            <p className="text-xs text-slate-400 mt-1">Hệ thống sẽ tự động chốt sao kê vào 08:30 ngày đến hạn hoặc khi trưởng nhóm tất toán trước hạn.</p>
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
                <span className="text-xs text-slate-400 font-medium block">
                  {totalToReceive > 0 ? "Số tiền bạn được nhận" : "Số tiền bạn cần chuyển"}
                </span>
                <span
                  className={`text-lg font-extrabold mt-0.5 block ${
                    totalToTransfer > 0
                      ? "text-rose-600"
                      : totalToReceive > 0
                      ? "text-emerald-600"
                      : "text-slate-700"
                  }`}
                >
                  {totalToTransfer > 0
                    ? `${formatVND(totalToTransfer)}`
                    : totalToReceive > 0
                    ? `Được nhận ${formatVND(totalToReceive)}`
                    : "0 ₫ (Đã hoàn tất)"}
                </span>
                <span className="text-xs text-slate-500 mt-1 block">
                  {totalToTransfer > 0
                    ? `Cần chuyển cho ${myPaymentRequests.length} thành viên`
                    : totalToReceive > 0
                    ? `${incomingPayments.length > 0 ? `${incomingPayments.length} thành viên sẽ chuyển cho bạn` : "Các thành viên khác sẽ chuyển lại cho bạn"}`
                    : "Không còn công nợ cần chuyển"}
                </span>
              </div>
            </div>

            {/* Khối 1: TỔNG KẾT & QUYẾT TOÁN CỦA BẠN (Reconciliation) */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Tổng Kết Quyết Toán Của Bạn Trong Kỳ</h3>
                </div>
                {totalToTransfer > 0 ? (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                    Cần chuyển: {formatVND(totalToTransfer)}
                  </span>
                ) : totalToReceive > 0 ? (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    Được nhận: {formatVND(totalToReceive)}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    Đã thanh toán đủ
                  </span>
                )}
              </div>

              <div className="p-6 space-y-4">
                {/* Banner giải thích công thức cấn trừ theo vị thế người nhận hay người chuyển */}
                {totalToReceive > 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 text-xs text-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        Chi tiết đối soát & quyền lợi nhận tiền của bạn:
                      </p>
                      <p className="text-slate-600">
                        • Tổng tiền bạn đã chi trả cho cả nhóm:{" "}
                        <strong className="text-slate-900">{formatVND(userTotalPaid)}</strong>
                      </p>
                      <p className="text-slate-600">
                        • Trừ phần tiền bạn tự tiêu (tham gia chia tiền):{" "}
                        <strong className="text-rose-600">-{formatVND(userTotalShare)}</strong>
                      </p>
                      {userOwesOthers > 0 && (
                        <p className="text-rose-600">
                          • Cấn trừ khoản bạn nợ từ các hóa đơn do người khác trả:{" "}
                          <strong>-{formatVND(userOwesOthers)}</strong>
                        </p>
                      )}
                    </div>
                    <div className="text-left md:text-right pt-2 md:pt-0 border-t md:border-t-0 border-emerald-200">
                      <span className="text-slate-500 block text-[11px]">Tổng số tiền bạn được nhận lại:</span>
                      <span className="text-xl font-black text-emerald-600">
                        +{formatVND(totalToReceive)}
                      </span>
                    </div>
                  </div>
                ) : totalToTransfer > 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                        Chi tiết cấn trừ công nợ của bạn:
                      </p>
                      <p className="text-slate-600">
                        • Tổng tiền các hóa đơn bạn tham gia chia tiền:{" "}
                        <strong className="text-slate-900">{formatVND(userTotalShare)}</strong>
                      </p>
                      {userTotalPaid > 0 && (
                        <p className="text-emerald-700">
                          • Cấn trừ từ các hóa đơn bạn đã chi trả cho nhóm:{" "}
                          <strong>-{formatVND(userTotalPaid)}</strong>
                        </p>
                      )}
                    </div>
                    <div className="text-left md:text-right pt-2 md:pt-0 border-t md:border-t-0 border-slate-200">
                      <span className="text-slate-500 block text-[11px]">Tổng số tiền bạn cần chuyển:</span>
                      <span className="text-xl font-black text-rose-600">
                        {formatVND(totalToTransfer)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">Chi tiết đối soát công nợ:</p>
                      <p className="text-slate-600 mt-1">
                        • Tiền bạn tham gia chia: <strong>{formatVND(userTotalShare)}</strong>
                        {userTotalPaid > 0 && ` — Bạn đã chi trả: ${formatVND(userTotalPaid)}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">Công nợ cân bằng (0 ₫)</span>
                  </div>
                )}

                {/* Danh sách các lệnh thanh toán user cần chuyển */}
                {myPaymentRequests.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Các khoản bạn cần chuyển khoản ({myPaymentRequests.length} người nhận)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {myPaymentRequests.map((req, idx) => (
                        <div
                          key={req.requestId || idx}
                          className="p-4 rounded-xl border border-rose-200 bg-rose-50/20 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs text-slate-500 block">Chuyển đến:</span>
                              <span className="text-sm font-bold text-slate-900">{req.creditorName}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 block">Số tiền:</span>
                              <span className="text-base font-extrabold text-rose-600">
                                {formatVND(req.amount)}
                              </span>
                            </div>
                          </div>

                          {/* Thông tin chuyển khoản */}
                          {req.accountNumber ? (
                            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Ngân hàng:</span>
                                <span className="font-semibold text-slate-800">
                                  {req.bankName || req.bankCode}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Số tài khoản:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-900">{req.accountNumber}</span>
                                  <button
                                    onClick={() => handleCopy(req.accountNumber, `stk-${idx}`)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                    title="Sao chép STK"
                                  >
                                    {copiedField === `stk-${idx}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Chủ tài khoản:</span>
                                <span className="font-medium text-slate-700">{req.accountHolderName}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                <span className="text-slate-500">Nội dung CK:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-indigo-700">{req.description}</span>
                                  <button
                                    onClick={() => handleCopy(req.description, `nd-${idx}`)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                                    title="Sao chép nội dung"
                                  >
                                    {copiedField === `nd-${idx}` ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 italic">Người nhận chưa thiết lập thông tin ngân hàng.</p>
                          )}

                          {/* Nút quét mã VietQR */}
                          {req.accountNumber && (
                            <button
                              onClick={() => handleOpenQr(req)}
                              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>Quét mã VietQR chuyển tiền</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : totalToReceive > 0 ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Bạn là người nhận tiền trong kỳ sao kê này. Các thành viên khác sẽ chuyển lại cho bạn tổng cộng{" "}
                        <strong>{formatVND(totalToReceive)}</strong>.
                      </span>
                    </div>

                    {incomingPayments.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Chi tiết các khoản sẽ chuyển cho bạn ({incomingPayments.length} người)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {incomingPayments.map((req, idx) => (
                            <div
                              key={req.requestId || idx}
                              className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 flex items-center justify-between"
                            >
                              <div>
                                <span className="text-xs text-slate-500 block">Người chuyển:</span>
                                <span className="text-sm font-bold text-slate-900">{req.debtorName}</span>
                                <div className="mt-1">
                                  <span
                                    className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                      req.status === "PAID"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {req.status === "PAID" ? "Đã nhận tiền" : "Chờ thanh toán"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-slate-500 block">Số tiền:</span>
                                <span className="text-base font-extrabold text-emerald-600">
                                  +{formatVND(req.amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Trong kỳ này bạn không có khoản nợ nào cần chuyển hoặc các khoản chi tiêu đã được cấn trừ hoàn toàn.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Khối 2: DANH SÁCH CHI TIẾT TỪNG HÓA ĐƠN TRONG KỲ (Transactions Table) */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900">Chi Tiết Từng Hóa Đơn Bạn Tham Gia</h3>
                </div>
                <div className="text-xs text-slate-500">
                  Tổng {transactions.length} hóa đơn bạn tham gia — Tổng tiền:{" "}
                  <strong className="text-slate-900">{formatVND(totalPeriodExpense)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Khoản chi tiêu</th>
                      <th className="px-4 py-3">Tổng tiền</th>
                      <th className="px-4 py-3">Người trả tiền</th>
                      <th className="px-4 py-3">Bạn cần trả</th>
                      <th className="px-4 py-3">Thành viên cùng chia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          Không có hóa đơn nào bạn tham gia trong khoảng thời gian của kỳ này.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => {
                        const hasUserShare = tx.currentUserShare > 0;
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Khoản chi tiêu */}
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{tx.title}</p>
                              <span className="text-[11px] text-slate-400">
                                {new Date(tx.createdAt).toLocaleDateString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </span>
                            </td>

                            {/* Tổng tiền ("total nhiêu") */}
                            <td className="px-4 py-3 font-extrabold text-slate-900 text-sm">
                              {formatVND(tx.totalAmount)}
                            </td>

                            {/* Người trả tiền ("ai trả") */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800">{tx.payerName}</span>
                                {tx.isUserPayer && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Bạn
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Bạn cần trả bao nhiêu từ đó */}
                            <td className="px-4 py-3">
                              {hasUserShare ? (
                                <div>
                                  <span className="font-bold text-rose-600 text-sm">
                                    {formatVND(tx.currentUserShare)}
                                  </span>
                                  {tx.isUserPayer && (
                                    <span className="block text-[10px] text-slate-500">
                                      (Bạn đã ứng cả hóa đơn)
                                    </span>
                                  )}
                                </div>
                              ) : tx.isUserPayer ? (
                                <div>
                                  <span className="font-semibold text-emerald-600">0 ₫</span>
                                  <span className="block text-[10px] text-slate-500">
                                    (Bạn đã ứng cả hóa đơn)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">— (Không tham gia)</span>
                              )}
                            </td>

                            {/* Thành viên cùng chia */}
                            <td className="px-4 py-3 max-w-[280px]">
                              <div className="flex flex-wrap gap-1">
                                {(tx.shares || []).map((s, idx) => (
                                  <span
                                    key={s.userId || idx}
                                    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {s.userName}: {formatVND(s.shareAmount)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {transactions.length > 0 && (
                    <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-800 text-xs">
                      <tr>
                        <td className="px-4 py-3">Tổng cộng ({transactions.length} hóa đơn bạn tham gia)</td>
                        <td className="px-4 py-3 text-slate-900 font-extrabold">{formatVND(totalPeriodExpense)}</td>
                        <td className="px-4 py-3">—</td>
                        <td className="px-4 py-3 text-rose-600 font-extrabold">
                          {formatVND(userTotalShare)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-normal">
                          {userTotalPaid > 0 && `(Bạn đã ứng trả cho nhóm: ${formatVND(userTotalPaid)})`}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Khối 3: CHI TIẾT CÔNG NỢ TOÀN BỘ CẢ NHÓM (Snapshot Table) */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bảng Tổng Hợp Công Nợ Cả Nhóm Đã Chốt</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lưu trữ bất biến tại thời điểm chốt kỳ ({new Date(statementData?.processedAt).toLocaleDateString("vi-VN")})
                  </p>
                </div>
                <span className="text-xs text-slate-500">{snapshotItems.length} khoản nợ</span>
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
                    {snapshotItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Không có khoản nợ nào trong kỳ này.
                        </td>
                      </tr>
                    ) : (
                      snapshotItems.map((item, idx) => {
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
                              {formatVND(item.amount)}
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
                    {formatVND(qrModalItem.amount)}
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
