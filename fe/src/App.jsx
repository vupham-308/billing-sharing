import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import OAuthCallback from "./pages/OAuthCallback";
import PaymentRequestDetail from "./pages/PaymentRequestDetail";
import GroupStatementDetail from "./pages/GroupStatementDetail";
import AdminOutbox from "./pages/AdminOutbox";

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

          {/* Chi tiết yêu cầu thanh toán (từ deep link trong email) */}
          <Route path="/payment-requests/:id" element={<PaymentRequestDetail />} />
          <Route path="/billing-sharing/payment-requests/:id" element={<PaymentRequestDetail />} />

          {/* Lịch sử sao kê nhóm */}
          <Route path="/groups/:groupId/statements" element={<GroupStatementDetail />} />
          <Route path="/billing-sharing/groups/:groupId/statements" element={<GroupStatementDetail />} />

          {/* Trang quản trị Email Outbox (viết chung trong fe) */}
          <Route path="/admin/outbox" element={<AdminOutbox />} />
          <Route path="/billing-sharing/admin/outbox" element={<AdminOutbox />} />

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
