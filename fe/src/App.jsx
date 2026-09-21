import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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

