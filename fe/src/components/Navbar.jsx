import React from "react";
import { Link } from "react-router-dom";
import { Receipt, PlusCircle, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ onOpenCreateTransaction, onOpenCreateGroup, onOpenAuthModal }) {
  const { user, logout } = useAuth();

  const displayName = user?.fullName || user?.name || "";
  const initial = displayName ? displayName.trim().slice(0, 1).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/billing-sharing" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:bg-indigo-700 transition-colors">
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
          </Link>

          {/* Right Actions & User Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Add Expense CTA */}
            {user && (
              <button
                onClick={onOpenCreateTransaction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm transition-all hover:shadow"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Thêm chi tiêu</span>
              </button>
            )}

            {/* Auth controls */}
            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAuthModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    {initial}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 hidden sm:inline max-w-[120px] truncate">
                    {displayName || "Người dùng"}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="Đăng xuất"
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
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
