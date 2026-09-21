import React from "react";
import { Receipt, PlusCircle, Users, ArrowUpRight, ArrowDownLeft, ShieldCheck, LogIn, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatVND } from "../utils/formatters";

export default function Navbar({ onOpenCreateTransaction, onOpenCreateGroup, onOpenAuthModal }) {
  const { user, isDemo, logout, refreshUser } = useAuth();
  const balance = user?.balance ?? 0;
  const isPositive = balance >= 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">ChiaTiền</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Billing Sharing
                </span>
              </div>
              <p className="text-xs text-slate-600 hidden sm:block">Chia sẻ chi phí minh bạch, chuẩn xác</p>
            </div>
          </div>

          {/* Center Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <button className="px-3.5 py-1.5 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50/80 transition-colors">
              Tổng quan
            </button>
            <button className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Nhóm chi tiêu
            </button>
            <button className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Hóa đơn
            </button>
            <button className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              Công nợ
            </button>
          </nav>

          {/* Right Actions & User Profile */}
          <div className="flex items-center gap-3">
            {/* Net Balance indicator */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                isPositive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {isPositive ? (
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>
                {isPositive ? "Được nợ ròng:" : "Cần trả ròng:"} {formatVND(Math.abs(balance))}
              </span>
            </div>

            {/* Quick Add Expense CTA */}
            <button
              onClick={onOpenCreateTransaction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-all hover:shadow"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Thêm chi tiêu</span>
            </button>

            {/* Demo badge & Auth controls */}
            {isDemo ? (
              <div className="flex items-center gap-2">
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  Demo Preview
                </span>
                <button
                  onClick={onOpenAuthModal}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-500" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center border border-slate-300">
                  {user?.name ? user.name.slice(0, 1).toUpperCase() : "U"}
                </div>
                <button
                  onClick={logout}
                  title="Đăng xuất"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
