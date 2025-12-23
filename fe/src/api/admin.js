import { request } from "./client";

export const adminApi = {
  listUsers: () => request("/admin/users"),
  setUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: "PUT", body: { role } }),
  toggleBlock: (id, blocked) => request(`/admin/users/${id}/block`, { method: "PUT", body: { blocked } }),

  listSellers: (status = "PENDING") => request(`/admin/sellers?status=${encodeURIComponent(status)}`),
  approveSeller: (userId) => request(`/admin/sellers/${userId}/approve`, { method: "POST" }),
  rejectSeller: (userId, reason) => request(`/admin/sellers/${userId}/reject`, { method: "POST", body: { reason } }),

  listCategories: () => request("/admin/categories"),
  createCategory: (payload) => request("/admin/categories", { method: "POST", body: payload }),
  updateCategory: (id, payload) => request(`/admin/categories/${id}`, { method: "PUT", body: payload }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: "DELETE" }),

  listProducts: () => request("/admin/products"),
  setProductStatus: (id, status) => request(`/admin/products/${id}/status`, { method: "PUT", body: { status } }),

  listOrders: () => request("/admin/orders"),
  forceCancel: (code, reason) => request(`/admin/orders/${encodeURIComponent(code)}/force-cancel`, { method: "POST", body: { reason } }),

  audit: () => request("/admin/audit"),
};
