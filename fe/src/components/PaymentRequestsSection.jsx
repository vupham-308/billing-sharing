import React, { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, QrCode, Check, X, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatVND, formatDate } from "../utils/formatters";

export default function PaymentRequestsSection({
  debts = [],
  credits = [],
  onOpenQrModal,
  onApproveCredit,
  onRejectCredit,
}) {
  const [activeTab, setActiveTab] = useState("DEBTS"); // "DEBTS" or "CREDITS"
  const [expandedId, setExpandedId] = useState(null);

  const pendingDebtsCount = debts.filter((d) => d.status === "PENDING").length;
  const waitingApprovalCreditsCount = credits.filter((c) => c.status === "WAITING_APPROVE").length;

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Yêu cầu thanh toán</h2>
          <p className="text-xs text-slate-500">Quyết toán trực tiếp qua VietQR SePay</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("DEBTS")}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "DEBTS"
              ? "bg-white text-rose-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Cần chuyển ({debts.length})</span>
          {pendingDebtsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("CREDITS")}
          className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === "CREDITS"
              ? "bg-white text-emerald-700 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Cần duyệt ({credits.length})</span>
          {waitingApprovalCreditsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          )}
        </button>
      </div>

      {/* Tab: DEBTS (You owe others) */}
      {activeTab === "DEBTS" && (
        <div className="space-y-3">
          {debts.map((item) => {
            const isPending = item.status === "PENDING";
            const isWaiting = item.status === "WAITING_APPROVE";
            const hasNetting = item.breakdown && item.breakdown.nettedCredit > 0;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Chuyển cho</span>
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {item.toUserName || "Người nhận"}
                    </h4>
                    {item.transactionTitle && (
                      <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.transactionTitle}
                      </span>
                    )}
                    {hasNetting && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md mt-1">
                        ✨ Đã cấn trừ 2 chiều
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-rose-600 block">
                      {formatVND(item.amount)}
                    </span>
                    {hasNetting && (
                      <div className="text-[10px] space-y-0.5 mt-0.5">
                        <span className="text-slate-400 line-through block">
                          Gốc: {formatVND(item.breakdown.grossDebt)}
                        </span>
                        <span className="text-emerald-600 font-medium block">
                          Trừ: -{formatVND(item.breakdown.nettedCredit)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {hasNetting && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                    >
                      <span>{isExpanded ? "Thu gọn giải trình" : "Xem chi tiết cấn trừ nợ"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-lg bg-sky-50/60 border border-sky-200 text-xs space-y-2">
                        <div className="font-medium text-sky-900 flex items-center justify-between">
                          <span>Chi tiết bù trừ:</span>
                          <span className="font-mono text-[11px] text-slate-600">{item.breakdown.formula}</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="text-rose-700 font-medium">
                            • Khoản bạn nợ ({item.toUserName}): {formatVND(item.breakdown.grossDebt)}
                          </div>
                          {item.breakdown.debtItems?.map((d, idx) => (
                            <div key={idx} className="pl-3 text-slate-600">
                              + {d.transactionTitle}: {formatVND(d.amount)}
                            </div>
                          ))}
                          <div className="text-emerald-700 font-medium pt-1">
                            • {item.toUserName} nợ lại bạn (khấu trừ): -{formatVND(item.breakdown.nettedCredit)}
                          </div>
                          {item.breakdown.nettedItems?.map((n, idx) => (
                            <div key={idx} className="pl-3 text-slate-600">
                              - {n.transactionTitle}: {formatVND(n.amount)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
                  {isPending ? (
                    <button
                      onClick={() => onOpenQrModal(item)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Quét VietQR SePay</span>
                    </button>
                  ) : isWaiting ? (
                    <div className="w-full flex items-center justify-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 py-1 px-2 rounded-lg font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Đã báo CK • Chờ người nhận duyệt</span>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-1 text-emerald-700 bg-emerald-50 py-1 px-2 rounded-lg font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã tất toán</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {debts.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-1.5 text-emerald-500" />
              <p className="text-xs font-medium text-slate-600">Tuyệt vời! Bạn không nợ khoản nào</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: CREDITS (Others owe you) */}
      {activeTab === "CREDITS" && (
        <div className="space-y-3">
          {credits.map((item) => {
            const isWaiting = item.status === "WAITING_APPROVE";
            const isPending = item.status === "PENDING";
            const hasNetting = item.breakdown && item.breakdown.nettedCredit > 0;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-500 block">Người chuyển</span>
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {item.fromUserName || "Thành viên"}
                    </h4>
                    {item.transactionTitle && (
                      <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.transactionTitle}
                      </span>
                    )}
                    {hasNetting && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md mt-1">
                        ✨ Đã cấn trừ 2 chiều
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-600 block">
                      +{formatVND(item.amount)}
                    </span>
                    {hasNetting && (
                      <div className="text-[10px] space-y-0.5 mt-0.5">
                        <span className="text-slate-400 line-through block">
                          Gốc: +{formatVND(item.breakdown.grossDebt)}
                        </span>
                        <span className="text-rose-600 font-medium block">
                          Khấu trừ: -{formatVND(item.breakdown.nettedCredit)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {hasNetting && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                    >
                      <span>{isExpanded ? "Thu gọn giải trình" : "Xem chi tiết cấn trừ nợ"}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-lg bg-sky-50/60 border border-sky-200 text-xs space-y-2">
                        <div className="font-medium text-sky-900 flex items-center justify-between">
                          <span>Chi tiết bù trừ:</span>
                          <span className="font-mono text-[11px] text-slate-600">{item.breakdown.formula}</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div className="text-emerald-700 font-medium">
                            • {item.fromUserName} nợ bạn: {formatVND(item.breakdown.grossDebt)}
                          </div>
                          {item.breakdown.debtItems?.map((d, idx) => (
                            <div key={idx} className="pl-3 text-slate-600">
                              + {d.transactionTitle}: {formatVND(d.amount)}
                            </div>
                          ))}
                          <div className="text-rose-700 font-medium pt-1">
                            • Bạn nợ lại {item.fromUserName} (khấu trừ): -{formatVND(item.breakdown.nettedCredit)}
                          </div>
                          {item.breakdown.nettedItems?.map((n, idx) => (
                            <div key={idx} className="pl-3 text-slate-600">
                              - {n.transactionTitle}: {formatVND(n.amount)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs">
                  {isWaiting ? (
                    <div>
                      <div className="flex items-center gap-1 text-amber-700 mb-2 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Đối phương báo đã chuyển khoản</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onApproveCredit(item.id)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã nhận tiền</span>
                        </button>
                        <button
                          onClick={() => onRejectCredit(item.id)}
                          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Chưa nhận</span>
                        </button>
                      </div>
                    </div>
                  ) : isPending ? (
                    <div className="flex items-center justify-between text-slate-500 py-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Chờ đối phương chuyển khoản</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Đã nhận thành công</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {credits.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <p className="text-xs font-medium text-slate-600">Không có yêu cầu chờ chuyển tiền nào</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
