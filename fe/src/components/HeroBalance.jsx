import React from "react";
import { Plus, Users, Wallet, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatVND } from "../utils/formatters";

export default function HeroBalance({
  user,
  totalOwedToYou = 0,
  totalYouOwe = 0,
  onOpenCreateTransaction,
  onOpenCreateGroup,
  onOpenPaymentInfo,
  groups = [],
  selectedGroupId,
}) {
  const netBalance = user?.balance ?? (totalOwedToYou - totalYouOwe);
  const isPositive = netBalance > 0;
  const isZero = netBalance === 0;

  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            <Wallet className="w-4 h-4 text-indigo-500" />
            <span>Tổng quan công nợ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Xin chào, {user?.name || "Bạn"}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Số liệu công nợ được đồng bộ tự động từ các hóa đơn và nhóm chi tiêu của bạn.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenCreateTransaction}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-all hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm hóa đơn</span>
          </button>
          <button
            onClick={onOpenCreateGroup}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>Tạo nhóm mới</span>
          </button>
          {groups.length > 0 && (
            <Link
              to={`/billing-sharing/groups/${selectedGroupId || groups[0].id}/statements`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Kỳ sao kê</span>
            </Link>
          )}
        </div>
      </div>

      {/* Net Balance Card */}
      <div className="pt-6">
        <div
          className={`relative overflow-hidden rounded-xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isZero
              ? "bg-slate-50/70 border-slate-200"
              : isPositive
              ? "bg-emerald-50/50 border-emerald-200/80"
              : "bg-rose-50/50 border-rose-200/80"
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              <span>Số dư</span>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                isZero ? "text-slate-700" : isPositive ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatVND(netBalance)}
            </div>
          </div>
          <p className="text-xs text-slate-500 sm:text-right max-w-sm">
            {isPositive
              ? "Bạn đã ứng tiền nhiều hơn phần của mình"
              : isZero
              ? "Bạn và mọi người không còn công nợ tồn đọng"
              : "Tổng số tiền bạn cần trả cho các thành viên khác"}
          </p>
        </div>
      </div>
    </section>
  );
}
