import { request } from "./client";

/**
 * Backend hiện tại mount auth tại /api/auth/*
 * - POST /api/auth/register
 * - POST /api/auth/login
 * - GET  /api/auth/me (Bearer token)
 * - POST /api/auth/logout
 */
export const authApi = {
  register(payload) {
    return request("/auth/register", { method: "POST", body: payload, auth: false });
  },

  login(payload) {
    return request("/auth/login", { method: "POST", body: payload, auth: false });
  },

  me() {
    return request("/auth/me", { method: "GET", auth: true });
  },

  logout() {
    // JWT stateless: backend chỉ trả success=true, FE xoá token là xong
    return request("/auth/logout", { method: "POST", auth: true });
  },

  changePassword(payload) {
    return request("/auth/change-password", { method: "POST", body: payload, auth: true });
  },

  applySeller(payload) {
    return request("/auth/seller/apply", { method: "POST", body: payload, auth: true });
  },
};
