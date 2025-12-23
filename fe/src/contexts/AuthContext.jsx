import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/auth.js";
import { clearToken, getToken, setToken as persistToken } from "../api/client.js";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getToken());
  const [booting, setBooting] = useState(true);

  // Prefer token-based auth. user could be null during boot while /me is fetching.
  const isAuthenticated = !!token;

  async function refreshMe() {
    if (!token) return { success: false };

    const res = await authApi.me();
    if (res?.success) {
      setUser(res.data);
      return { success: true, data: res.data };
    }

    // Token lỗi/hết hạn
    clearToken();
    setTokenState(null);
    setUser(null);
    return { success: false, message: res?.message || "Phiên đăng nhập không hợp lệ" };
  }

  useEffect(() => {
    // Auto-login nếu có token
    (async () => {
      try {
        await refreshMe();
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(identifier, password) {
    const res = await authApi.login({ username: identifier, password });

    if (res?.success && res?.data?.token) {
      persistToken(res.data.token);
      setTokenState(res.data.token);
      setUser(res.data.user);
      return { success: true, data: res.data };
    }

    return { success: false, message: res?.message || "Đăng nhập thất bại" };
  }

  async function register(payload) {
    const res = await authApi.register(payload);
    if (res?.success) return { success: true, message: res?.message || "Đăng ký thành công", data: res?.data };
    return { success: false, message: res?.message || "Đăng ký thất bại" };
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      clearToken();
      setTokenState(null);
      setUser(null);
    }
  }

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      isAuthenticated,
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, token, booting, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
