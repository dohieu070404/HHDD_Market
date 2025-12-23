import { request } from "./client";

function qs(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const customerApi = {
  getProfile: () => request("/customer/profile"),
  updateProfile: (payload) => request("/customer/profile", { method: "PUT", body: payload }),

  listAddresses: () => request("/customer/addresses"),
  createAddress: (payload) => request("/customer/addresses", { method: "POST", body: payload }),
  updateAddress: (id, payload) => request(`/customer/addresses/${id}`, { method: "PUT", body: payload }),
  deleteAddress: (id) => request(`/customer/addresses/${id}`, { method: "DELETE" }),
  setDefaultAddress: (id) => request(`/customer/addresses/${id}/default`, { method: "POST" }),

  checkout: (payload) => request("/customer/checkout", { method: "POST", body: payload }),
  listOrders: ({ page = 1, limit = 10 } = {}) => request(`/customer/orders${qs({ page, limit })}`),
  getOrder: (code) => request(`/customer/orders/${encodeURIComponent(code)}`),
  track: (code) => request(`/customer/orders/${encodeURIComponent(code)}/tracking`),
  confirmReceived: (code) => request(`/customer/orders/${encodeURIComponent(code)}/confirm-received`, { method: "POST" }),
  cancelRequest: (code, reason) =>
    request(`/customer/orders/${encodeURIComponent(code)}/cancel-request`, { method: "POST", body: { reason } }),
  returnRequest: (code, reason) =>
    request(`/customer/orders/${encodeURIComponent(code)}/return-request`, { method: "POST", body: { reason } }),
  refundRequest: (code, reason) =>
    request(`/customer/orders/${encodeURIComponent(code)}/refund-request`, { method: "POST", body: { reason } }),

  createDispute: (code, payload) =>
    request(`/customer/orders/${encodeURIComponent(code)}/dispute`, { method: "POST", body: payload }),
  getChat: (code) => request(`/customer/orders/${encodeURIComponent(code)}/chat`),
  sendChat: (code, message) =>
    request(`/customer/orders/${encodeURIComponent(code)}/chat`, { method: "POST", body: { message } }),

  createProductReview: (productId, payload) =>
    request(`/customer/reviews/product/${productId}`, { method: "POST", body: payload }),
  updateReview: (id, payload) => request(`/customer/reviews/${id}`, { method: "PUT", body: payload }),
  deleteReview: (id) => request(`/customer/reviews/${id}`, { method: "DELETE" }),
};
