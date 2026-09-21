import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export const DEMO_USER = {
  id: "0191eb45-87d2-7c30-9b4f-51978216d001",
  name: "Nguyễn Văn Nam",
  email: "nam.nguyen@example.com",
  balance: 340000,
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        // If no token, default to Demo mode so user can immediately preview the rich dashboard!
        setUser(DEMO_USER);
        setIsDemo(true);
        setIsLoading(false);
        return;
      }
      try {
        const userData = await authApi.getMe();
        setUser(userData);
        setIsDemo(false);
      } catch (err) {
        console.warn("Failed to load user with token, fallback to demo user", err);
        setUser(DEMO_USER);
        setIsDemo(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser(res.user);
      setIsDemo(false);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại.",
      };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await authApi.register({ name, email, password });
      localStorage.setItem("token", res.token);
      setToken(res.token);
      setUser(res.user);
      setIsDemo(false);
      return { success: true };
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
    setUser(DEMO_USER);
    setIsDemo(true);
  };

  const refreshUser = async () => {
    if (token && !isDemo) {
      try {
        const userData = await authApi.getMe();
        setUser(userData);
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
        isDemo,
        setIsDemo,
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
