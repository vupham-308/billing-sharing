import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Nếu chưa đăng nhập hoặc mất authorize: chuyển hướng ngay về trang đăng nhập (/billing-sharing)
    return <Navigate to="/billing-sharing" state={{ from: location }} replace />;
  }

  if (requireAdmin && user.role !== "ADMIN") {
    return <Navigate to="/billing-sharing" replace />;
  }

  return children;
}
