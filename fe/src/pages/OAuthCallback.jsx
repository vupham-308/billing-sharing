import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, CheckCircle2, Receipt } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogle, user } = useAuth();

  const [status, setStatus] = useState("PROCESSING"); // "PROCESSING" | "SUCCESS" | "ERROR"
  const [errorMessage, setErrorMessage] = useState("");
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    let isCancelled = false;

    async function handleCallback() {
      // 1. Kiểm tra query parameters hoặc hash fragment
      let idToken = searchParams.get("credential") || searchParams.get("id_token");

      if (!idToken && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        idToken = hashParams.get("id_token") || hashParams.get("credential");
      }

      // Trường hợp Google Authorization Code
      const code = searchParams.get("code");

      if (!idToken && !code) {
        if (!isCancelled) {
          setStatus("ERROR");
          setErrorMessage("Không tìm thấy thông tin xác thực từ Google. Vui lòng thử đăng nhập lại.");
        }
        return;
      }

      try {
        const tokenToVerify = idToken || code;
        const result = await loginWithGoogle(tokenToVerify);

        if (isCancelled) return;

        if (result.success) {
          setStatus("SUCCESS");
          setTimeout(() => {
            navigate("/billing-sharing");
          }, 1000);
        } else if (result.isNewUser) {
          // User Google chưa có trong hệ thống -> lưu thông tin pending vào sessionStorage và back về /billing-sharing để nhập STK
          sessionStorage.setItem(
            "google_pending_registration",
            JSON.stringify({
              idToken: result.idToken || tokenToVerify,
              email: result.email,
              fullName: result.fullName,
            })
          );
          navigate("/billing-sharing", { replace: true });
        } else {
          setStatus("ERROR");
          setErrorMessage(result.message || "Xác thực đăng nhập Google thất bại.");
        }
      } catch (err) {
        if (!isCancelled) {
          setStatus("ERROR");
          setErrorMessage(err.message || "Đã xảy ra lỗi trong quá trình xử lý đăng nhập Google.");
        }
      }
    }

    handleCallback();

    return () => {
      isCancelled = true;
    };
  }, [searchParams, loginWithGoogle, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link to="/billing-sharing" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">ChiaTiền</span>
              <span className="text-[10px] font-medium px-2 py-0.5 ml-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Google OAuth
              </span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 text-center space-y-5">
          {status === "PROCESSING" && (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Đang xác thực tài khoản Google...</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Vui lòng đợi trong giây lát, hệ thống đang kết nối an toàn với Google.
              </p>
            </div>
          )}

          {status === "SUCCESS" && (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Đăng nhập thành công!</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đang chuyển hướng bạn đến bảng quản lý chi tiêu...
              </p>
            </div>
          )}

          {status === "ERROR" && (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Đăng nhập không thành công</h2>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                {errorMessage}
              </div>
              <button
                onClick={() => navigate("/billing-sharing")}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
              >
                Quay lại trang chủ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
