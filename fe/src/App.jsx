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
import SepayGuide from "./pages/SepayGuide";

import ProtectedRoute from "./components/ProtectedRoute";

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

          {/* Chi tiết yêu cầu thanh toán (yêu cầu đăng nhập) */}
          <Route
            path="/payment-requests/:id"
            element={
              <ProtectedRoute>
                <PaymentRequestDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-sharing/payment-requests/:id"
            element={
              <ProtectedRoute>
                <PaymentRequestDetail />
              </ProtectedRoute>
            }
          />

          {/* Lịch sử sao kê nhóm (yêu cầu đăng nhập) */}
          <Route
            path="/groups/:groupId/statements"
            element={
              <ProtectedRoute>
                <GroupStatementDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-sharing/groups/:groupId/statements"
            element={
              <ProtectedRoute>
                <GroupStatementDetail />
              </ProtectedRoute>
            }
          />

          {/* Trang quản trị Email Outbox (yêu cầu quyền ADMIN) */}
          <Route
            path="/admin/outbox"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminOutbox />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing-sharing/admin/outbox"
            element={
              <ProtectedRoute requireAdmin={true}>
                <AdminOutbox />
              </ProtectedRoute>
            }
          />

          {/* Trang hướng dẫn thiết lập SePay Webhook */}
          <Route path="/guides/sepay-setup" element={<SepayGuide />} />
          <Route path="/billing-sharing/guides/sepay-setup" element={<SepayGuide />} />

          {/* Đường dẫn đăng nhập trực tiếp trỏ về /billing-sharing */}
          <Route path="/login" element={<Navigate to="/billing-sharing" replace />} />
          <Route path="/billing-sharing/login" element={<Navigate to="/billing-sharing" replace />} />

          {/* Trang chủ mặc định là /billing-sharing (tự động render form Login nếu chưa xác thực) */}
          <Route path="/billing-sharing" element={<Dashboard />} />

          {/* Fallback tất cả đường dẫn / và các đường dẫn khác về /billing-sharing */}
          <Route path="/" element={<Navigate to="/billing-sharing" replace />} />
          <Route path="*" element={<Navigate to="/billing-sharing" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
