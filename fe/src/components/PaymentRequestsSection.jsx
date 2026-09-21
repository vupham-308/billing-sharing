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

  const pendingDebtsCount = debts.filter((d) => d.status === "PENDING").length;
  const waitingApprovalCreditsCount = credits.filter((c) => c.status === "WAITING_APPROVE").length;

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
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-rose-600">
                      {formatVND(item.amount)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
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
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600">
                      +{formatVND(item.amount)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs">
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
