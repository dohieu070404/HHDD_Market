import { request } from "./client";

export const sellerApi = {
  getShop: () => request("/seller/shop"),
  updateShop: (payload) => request("/seller/shop", { method: "PUT", body: payload }),

  listProducts: () => request("/seller/products"),
  createProduct: (payload) => request("/seller/products", { method: "POST", body: payload }),
  updateProduct: (id, payload) => request(`/seller/products/${id}`, { method: "PUT", body: payload }),
  setProductVisibility: (id, status) => request(`/seller/products/${id}/visibility`, { method: "POST", body: { status } }),

  listSkus: (productId) => request(`/seller/products/${productId}/skus`),
  createSku: (productId, payload) => request(`/seller/products/${productId}/skus`, { method: "POST", body: payload }),
  updateSku: (skuId, payload) => request(`/seller/skus/${skuId}`, { method: "PUT", body: payload }),

  listOrders: ({ page = 1, limit = 20 } = {}) => request(`/seller/orders?${new URLSearchParams({ page: String(page), limit: String(limit) })}`),
  confirmOrder: (code) => request(`/seller/orders/${encodeURIComponent(code)}/confirm`, { method: "POST" }),
  packOrder: (code) => request(`/seller/orders/${encodeURIComponent(code)}/pack`, { method: "POST" }),
  createShipment: (code) => request(`/seller/orders/${encodeURIComponent(code)}/create-shipment`, { method: "POST" }),
  updateShipment: (code, payload) => request(`/seller/orders/${encodeURIComponent(code)}/update-shipment`, { method: "POST", body: payload }),
  cancelOrder: (code, payload) => request(`/seller/orders/${encodeURIComponent(code)}/cancel`, { method: "POST", body: payload }),
  orderDetail: (code) => request(`/seller/orders/${encodeURIComponent(code)}`),

  analyticsSummary: () => request("/seller/analytics/summary"),
};
