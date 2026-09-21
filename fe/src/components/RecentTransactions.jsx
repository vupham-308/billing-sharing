import React, { useState } from "react";
import { Receipt, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, UserCheck, Clock, Filter } from "lucide-react";
import { formatVND, formatDate } from "../utils/formatters";

export default function RecentTransactions({
  transactions = [],
  currentUserId,
  page = 0,
  totalPages = 1,
  onPageChange,
  dateFilter,
  onDateFilterChange,
}) {
  const [expandedTxId, setExpandedTxId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedTxId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Hóa đơn gần đây</h2>
            <p className="text-xs text-slate-500">Mặc định 10 hóa đơn mới nhất có bạn tham gia</p>
          </div>
        </div>

        {/* Date quick filter pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => onDateFilterChange("ALL")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => onDateFilterChange("7DAYS")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "7DAYS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            7 ngày
          </button>
          <button
            onClick={() => onDateFilterChange("MONTH")}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              dateFilter === "MONTH" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tháng này
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="divide-y divide-slate-100">
        {transactions.map((tx) => {
          const isPayer = tx.payerId === currentUserId || tx.payerName === "Bạn";
          // Find current user's share in this transaction
          const myShareObj = tx.sharingMembers?.find(
            (m) => m.userId === currentUserId || m.userName === "Bạn"
          );
          const myShareAmount = myShareObj ? myShareObj.amount : 0;
          const isExpanded = expandedTxId === tx.id;

          // Net effect on user:
          // If user paid 100k, their own share is 20k -> they get back +80k
          // If someone else paid, user's share is 20k -> user owes -20k
          const netEffect = isPayer ? tx.totalAmount - myShareAmount : -myShareAmount;

          return (
            <div key={tx.id} className="py-4 hover:bg-slate-50/50 rounded-xl px-2 transition-colors">
              <div
                className="flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => toggleExpand(tx.id)}
              >
                {/* Left: Icon & Title & Date */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                    <Receipt className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 text-sm">{tx.title}</h3>
                      {tx.groupName && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {tx.groupName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {formatDate(tx.createdAt || tx.date)}
                      </span>
                      <span>•</span>
                      <span>
                        Người trả:{" "}
                        <strong className="text-slate-700 font-medium">
                          {isPayer ? "Bạn" : tx.payerName}
                        </strong>{" "}
                        ({formatVND(tx.totalAmount)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Net Impact & Expand Icon */}
                <div className="flex items-center gap-3 text-right shrink-0">
                  <div>
                    <span className="text-[11px] text-slate-500 block">
                      {isPayer ? "Bạn được nhận lại" : "Phần của bạn"}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        isPayer
                          ? "text-emerald-600"
                          : netEffect < 0
                          ? "text-rose-600"
                          : "text-slate-700"
                      }`}
                    >
                      {netEffect > 0 ? "+" : ""}
                      {formatVND(netEffect)}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expandable Breakdown Drawer */}
              {isExpanded && (
                <div className="mt-3.5 pt-3.5 border-t border-slate-100 pl-13 pr-2 text-xs bg-slate-50/70 p-3 rounded-lg">
                  <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
                    <span>Chi tiết chia tiền ({tx.sharingMembers?.length || 0} người tham gia):</span>
                    <span className="text-slate-500 font-normal">Tổng: {formatVND(tx.totalAmount)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {tx.sharingMembers?.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-white border border-slate-200/80"
                      >
                        <span className="text-slate-700 font-medium">
                          {m.userName || (m.userId === currentUserId ? "Bạn" : "Thành viên")}
                        </span>
                        <span className="font-semibold text-slate-900">{formatVND(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {transactions.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">Chưa có hóa đơn nào trong khoảng thời gian này</p>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Trang <strong>{page + 1}</strong> trên <strong>{totalPages}</strong>
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 0}
              onClick={() => onPageChange(page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
