import { request } from "./client";

export const adminApi = {
  listUsers: () => request("/admin/users"),
  setUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: "PUT", body: { role } }),
  toggleBlock: (id, blocked) =>
    request(`/admin/users/${id}/block`, { method: "PUT", body: { isBlocked: blocked } }),

  listSellers: (status = "PENDING") => request(`/admin/sellers?status=${encodeURIComponent(status)}`),
  approveSeller: (userId) => request(`/admin/sellers/${userId}/approve`, { method: "PUT" }),
  rejectSeller: (userId, reason) => request(`/admin/sellers/${userId}/reject`, { method: "PUT", body: { reason } }),

  listCategories: () => request("/admin/categories"),
  createCategory: (payload) => request("/admin/categories", { method: "POST", body: payload }),
  updateCategory: (id, payload) => request(`/admin/categories/${id}`, { method: "PUT", body: payload }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: "DELETE" }),

  listProducts: () => request("/admin/products"),
  setProductStatus: (id, status) => request(`/admin/products/${id}/status`, { method: "PUT", body: { status } }),

  listOrders: () => request("/admin/orders"),
  forceCancel: (code, reason) => request(`/admin/orders/${encodeURIComponent(code)}/force-cancel`, { method: "POST", body: { reason } }),

  // --- Vouchers ---
  listVouchers: () => request("/admin/vouchers"),
  createVoucher: (payload) => request("/admin/vouchers", { method: "POST", body: payload }),
  updateVoucher: (id, payload) => request(`/admin/vouchers/${id}`, { method: "PUT", body: payload }),
  deleteVoucher: (id) => request(`/admin/vouchers/${id}`, { method: "DELETE" }),

  listShops: (params = {}) => {
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.status) q.set("status", params.status);
    const suffix = q.toString();
    return request(`/admin/shops${suffix ? `?${suffix}` : ""}`);
  },

  updateShopStatus: (id, payload) => request(`/admin/shops/${id}/status`, { method: "PUT", body: payload }),

  listShopReports: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.shopId) q.set("shopId", String(params.shopId));
    const suffix = q.toString();
    return request(`/admin/shop-reports${suffix ? `?${suffix}` : ""}`);
  },
  resolveShopReport: (id, payload) => request(`/admin/shop-reports/${id}/resolve`, { method: "PUT", body: payload }),

  moderateShop: (id, payload) => request(`/admin/shops/${id}/moderate`, { method: "PUT", body: payload }),

  // Disputes (complaints)
  listDisputes: () => request("/admin/disputes"),
  resolveDispute: (id, payload) => request(`/admin/disputes/${id}/resolve`, { method: "PUT", body: payload }),

  audit: () => request("/admin/audit"),
};