import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, paymentInfoApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const userData = await authApi.getMe();
        if (userData) {
          userData.name = userData.fullName || userData.name;
        }
        setUser(userData);
      } catch (err) {
        console.warn("Failed to load user with token, clearing session", err);
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      const authToken = res.accessToken || res.token;
      localStorage.setItem("token", authToken);
      setToken(authToken);

      const loggedUser = res.user || {};
      loggedUser.name = loggedUser.fullName || loggedUser.name;
      setUser(loggedUser);

      return { success: true, user: loggedUser };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.",
      };
    }
  };

  const register = async (name, email, password, bankInfo = null) => {
    try {
      const res = await authApi.register({
        fullName: name.trim(),
        email: email.trim(),
        password,
      });

      const authToken = res.accessToken || res.token;
      localStorage.setItem("token", authToken);
      setToken(authToken);

      const loggedUser = res.user || {};
      loggedUser.name = loggedUser.fullName || loggedUser.name;
      setUser(loggedUser);

      // Nếu có truyền kèm thông tin tài khoản ngân hàng, lưu ngay lập tức
      if (bankInfo && bankInfo.accountNumber) {
        try {
          await paymentInfoApi.saveMyInfo(bankInfo);
        } catch (infoErr) {
          console.error("Không thể lưu thông tin STK ngân hàng ban đầu", infoErr);
        }
      }

      return { success: true, user: loggedUser };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const userData = await authApi.getMe();
        if (userData) {
          userData.name = userData.fullName || userData.name;
        }
        setUser(userData);
        return userData;
      } catch (err) {
        console.error("Failed to refresh user", err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        setUser,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
