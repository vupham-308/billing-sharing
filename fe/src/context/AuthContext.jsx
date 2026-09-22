import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { authApi } from "../services/api";
import { cookieUtils } from "../utils/cookie";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => cookieUtils.get("token") || localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);
  const hydratedToken = useRef(null);

  useEffect(() => {
    let active = true;
    async function loadUser() {
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      if (hydratedToken.current === token) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await authApi.getMe();
        if (!active) return;
        if (userData) {
          userData.name = userData.fullName || userData.name;
        }
        setUser(userData);
        hydratedToken.current = token;
      } catch (err) {
        if (!active) return;
        console.warn("Failed to load user with token, clearing session", err);
        cookieUtils.remove("token");
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadUser();

    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      active = false;
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await authApi.login({ email, password });
      const authToken = res.accessToken || res.token;
      hydratedToken.current = res.user ? authToken : null;
      cookieUtils.set("token", authToken, 30);
      localStorage.removeItem("token");
      setToken(authToken);

      const loggedUser = res.user || {};
      loggedUser.name = loggedUser.fullName || loggedUser.name;
      setUser(loggedUser);

      return { success: true, user: loggedUser };
    } catch (err) {
      const isNeedActivation =
        err.response?.data?.needActivation ||
        (err.response?.status === 403 &&
          err.response?.data?.message?.toLowerCase().includes("kích hoạt"));

      return {
        success: false,
        needActivation: isNeedActivation,
        message:
          err.response?.data?.message ||
          "Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.",
      };
    }
  };

  const register = async (name, email, password, bankInfo = null) => {
    try {
      const registerPayload = {
        fullName: name.trim(),
        email: email.trim(),
        password,
      };

      if (bankInfo && bankInfo.accountNumber) {
        registerPayload.bankCode = bankInfo.bankCode;
        registerPayload.bankName = bankInfo.bankName;
        registerPayload.accountNumber = bankInfo.accountNumber;
        registerPayload.accountHolderName = bankInfo.accountHolderName;
      }

      const res = await authApi.register(registerPayload);

      const authToken = res.accessToken || res.token;
      const loggedUser = res.user || {};
      loggedUser.name = loggedUser.fullName || loggedUser.name;

      if (authToken) {
        hydratedToken.current = res.user ? authToken : null;
        cookieUtils.set("token", authToken, 30);
        localStorage.removeItem("token");
        setToken(authToken);
        setUser(loggedUser);
      }

      return {
        success: true,
        user: loggedUser,
        needActivation: !loggedUser.isActive || !authToken,
        message: !loggedUser.isActive
          ? "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt tài khoản."
          : "Đăng ký thành công!",
      };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.",
      };
    }
  };

  const loginWithGoogle = useCallback(async (googleParam) => {
    try {
      const payload = typeof googleParam === "string" ? { idToken: googleParam } : googleParam;
      const res = await authApi.loginGoogle(payload);

      // Nếu user Google chưa tồn tại trong hệ thống, backend trả về isNewUser: true
      if (res.isNewUser) {
        return {
          success: false,
          isNewUser: true,
          email: res.user?.email,
          fullName: res.user?.fullName,
          idToken: payload.idToken,
        };
      }

      const authToken = res.accessToken || res.token;
      hydratedToken.current = res.user ? authToken : null;
      cookieUtils.set("token", authToken, 30);
      localStorage.removeItem("token");
      setToken(authToken);

      const loggedUser = res.user || {};
      loggedUser.name = loggedUser.fullName || loggedUser.name;
      setUser(loggedUser);

      return { success: true, user: loggedUser };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Đăng nhập Google thất bại. Vui lòng thử lại.",
      };
    }
  }, []);

  const logout = () => {
    hydratedToken.current = null;
    cookieUtils.remove("token");
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
        loginWithGoogle,
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
