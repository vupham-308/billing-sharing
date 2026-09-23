import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Receipt, LogIn, LogOut, ShieldCheck, LayoutDashboard, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ onOpenCreateTransaction, onOpenCreateGroup, onOpenAuthModal }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const displayName = user?.fullName || user?.name || "";
  const initial = displayName ? displayName.trim().slice(0, 1).toUpperCase() : "U";
  const isAdmin = user?.role === "ADMIN";
  const isOnAdminPage = location.pathname.includes("/admin");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

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
                <span className="font-bold text-lg text-slate-900 tracking-tight">Billing Sharing</span>
                {isAdmin && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 hidden sm:block">Chia sẻ chi phí minh bạch, chuẩn xác</p>
            </div>
          </Link>

          {/* Right Actions & User Profile */}
          <div className="flex items-center gap-3">


            {/* Auth controls */}
            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAuthModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                {/* User Avatar Button with Click Toggle */}
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  aria-expanded={dropdownOpen}
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {initial}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 hidden sm:inline max-w-[120px] truncate">
                    {displayName || "Tài khoản"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    {/* User Info Header */}
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-900 truncate">{displayName || "Người dùng"}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isAdmin
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {isAdmin ? "Quản trị viên (Admin)" : "Thành viên"}
                        </span>
                      </div>
                    </div>

                    {/* Admin Navigation Button */}
                    {isAdmin && (
                      <div className="p-1 border-b border-slate-100">
                        {isOnAdminPage ? (
                          <Link
                            to="/billing-sharing"
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                            <span>Trang người dùng</span>
                          </Link>
                        ) : (
                          <Link
                            to="/billing-sharing/admin/outbox"
                            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4 text-purple-600" />
                            <span>Trang quản trị (Outbox)</span>
                          </Link>
                        )}
                      </div>
                    )}

                    {/* Regular Actions */}
                    <div className="p-1">
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
