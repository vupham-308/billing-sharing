import React from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Users, Wallet } from "lucide-react";
import { formatVND } from "../utils/formatters";

export default function HeroBalance({
  user,
  totalOwedToYou = 0,
  totalYouOwe = 0,
  onOpenCreateTransaction,
  onOpenCreateGroup,
  onOpenPaymentInfo,
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
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 transition-colors"
          >
            <Users className="w-4 h-4 text-slate-600" />
            <span>Tạo nhóm mới</span>
          </button>
        </div>
      </div>

      {/* 3 Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-6">
        {/* Net Balance */}
        <div
          className={`relative overflow-hidden rounded-xl p-5 border ${
            isZero
              ? "bg-slate-50/70 border-slate-200"
              : isPositive
              ? "bg-emerald-50/50 border-emerald-200/80"
              : "bg-rose-50/50 border-rose-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
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
          <p className="text-xs text-slate-500 mt-1">
            {isPositive
              ? "Bạn đã ứng tiền nhiều hơn phần của mình"
              : isZero
              ? "Bạn và mọi người không còn công nợ tồn đọng"
              : "Tổng số tiền bạn cần trả cho các thành viên khác"}
          </p>
        </div>

        {/* You are owed */}
        <div className="rounded-xl p-5 bg-white border border-slate-200/80 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bạn đang được nợ
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {formatVND(totalOwedToYou)}
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1">
            Khoản tiền người khác sẽ chuyển lại cho bạn
          </p>
        </div>

        {/* You owe */}
        <div className="rounded-xl p-5 bg-white border border-slate-200/80 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Bạn cần thanh toán
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {formatVND(totalYouOwe)}
          </div>
          <p className="text-xs text-rose-600 font-medium mt-1">
            Các khoản bạn cần chuyển khoản thanh toán
          </p>
        </div>
      </div>
    </section>
  );
}
