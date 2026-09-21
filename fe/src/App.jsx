import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import OAuthCallback from "./pages/OAuthCallback";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Đường dẫn tiếp nhận chuyển hướng từ Google OAuth */}
          <Route path="/callback" element={<OAuthCallback />} />
          <Route path="/billing-sharing/callback" element={<OAuthCallback />} />

          {/* Đường dẫn xác thực email */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/billing-sharing/verify-email" element={<VerifyEmail />} />

          {/* Đường dẫn độc lập cho trang Đặt lại mật khẩu từ email */}
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/billing-sharing/reset-password" element={<ResetPassword />} />

          {/* Trang chủ mặc định là /billing-sharing */}
          <Route path="/billing-sharing" element={<Dashboard />} />

          {/* Fallback tất cả đường dẫn / và các đường dẫn khác về /billing-sharing */}
          <Route path="/" element={<Navigate to="/billing-sharing" replace />} />
          <Route path="*" element={<Navigate to="/billing-sharing" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
