import { request, requestFormData } from "./client";

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const customerApi = {
  // Profile
  getProfile() {
    return request("/customer/profile");
  },
  updateProfile(payload) {
    return request("/customer/profile", { method: "PUT", body: payload });
  },
  uploadAvatar(file) {
    const fd = new FormData();
    fd.append("avatar", file);
    return requestFormData("/customer/profile/avatar", { method: "POST", formData: fd });
  },

  // Upload images
  uploadReviewImages(files = []) {
    const fd = new FormData();
    (files || []).forEach((f) => fd.append("reviewImages", f));
    return requestFormData("/customer/uploads/review-images", { method: "POST", formData: fd });
  },
  uploadDisputeImages(files = []) {
    const fd = new FormData();
    (files || []).forEach((f) => fd.append("disputeImages", f));
    return requestFormData("/customer/uploads/dispute-images", { method: "POST", formData: fd });
  },

  // Addresses
  listAddresses() {
    return request("/customer/addresses");
  },
  createAddress(payload) {
    return request("/customer/addresses", { method: "POST", body: payload });
  },
  updateAddress(id, payload) {
    return request(`/customer/addresses/${id}`, { method: "PUT", body: payload });
  },
  deleteAddress(id) {
    return request(`/customer/addresses/${id}`, { method: "DELETE" });
  },
  setDefaultAddress(id) {
    return request(`/customer/addresses/${id}/default`, { method: "POST" });
  },

  // Checkout / Shipping
  quoteShippingOptions(payload) {
    return request("/customer/shipping/options", { method: "POST", body: payload });
  },
  createCheckoutDraft(payload) {
    return request("/customer/checkout/draft", { method: "POST", body: payload });
  },
  getCheckoutDraft(code) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}`);
  },
  updateCheckoutDraftShipping(code, payload) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}/shipping`, { method: "PATCH", body: payload });
  },
  getCheckoutDraftVouchers(code) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}/vouchers`);
  },
  updateCheckoutDraftVoucher(code, voucherCode) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}/voucher`, {
      method: "PATCH",
      body: { voucherCode },
    });
  },
  updateCheckoutDraftShopVoucher(code, shopId, voucherCode) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}/shop-voucher`, {
      method: "PATCH",
      body: { shopId, voucherCode },
    });
  },
  updateCheckoutDraftNote(code, note) {
    return request(`/customer/checkout/draft/${encodeURIComponent(code)}/note`, {
      method: "PATCH",
      body: { note },
    });
  },
  commitCheckout(payload, { idempotencyKey } = {}) {
    const headers = idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined;
    return request("/customer/checkout/commit", { method: "POST", body: payload, headers });
  },

  // Orders
  listOrderGroups(params = {}) {
    return request(`/customer/order-groups${toQuery(params)}`);
  },
  getOrderGroup(groupCode) {
    return request(`/customer/order-groups/${encodeURIComponent(groupCode)}`);
  },
  listOrders(params = {}) {
    return request(`/customer/orders${toQuery(params)}`);
  },
  getOrder(code) {
    return request(`/customer/orders/${encodeURIComponent(code)}`);
  },
  getOrderTracking(code) {
    return request(`/customer/orders/${encodeURIComponent(code)}/tracking`);
  },
  confirmReceived(code) {
    return request(`/customer/orders/${encodeURIComponent(code)}/confirm-received`, { method: "POST" });
  },
  cancelRequest(code, reason) {
    return request(`/customer/orders/${encodeURIComponent(code)}/cancel-request`, { method: "POST", body: { reason } });
  },
  returnRequest(code, reason) {
    // Backward compatible: can pass a string reason or an object { reason, requestType, evidenceUrls }
    const body = typeof reason === "string" ? { reason } : reason;
    return request(`/customer/orders/${encodeURIComponent(code)}/return-request`, { method: "POST", body });
  },
  refundRequest(code, reason) {
    return request(`/customer/orders/${encodeURIComponent(code)}/refund-request`, { method: "POST", body: { reason } });
  },
  createDispute(code, payload) {
    return request(`/customer/orders/${encodeURIComponent(code)}/dispute`, { method: "POST", body: payload });
  },
  listDisputes() {
    return request("/customer/disputes");
  },
  requestDisputeRevision(disputeId, payload = {}) {
    return request(`/customer/disputes/${encodeURIComponent(disputeId)}/request-revision`, { method: "POST", body: payload });
  },
  listNotifications() {
    return request("/customer/notifications");
  },
  markNotificationRead(id) {
    return request(`/customer/notifications/${id}/read`, { method: "PUT" });
  },
  getChat(code) {
    return request(`/customer/orders/${encodeURIComponent(code)}/chat`);
  },
  sendChat(code, message) {
    return request(`/customer/orders/${encodeURIComponent(code)}/chat`, { method: "POST", body: { message } });
  },

  // Reviews
  listMyReviews(params = {}) {
    return request(`/customer/reviews${toQuery(params)}`);
  },
  createProductReview(productId, payload) {
    return request(`/customer/reviews/product/${productId}`, { method: "POST", body: payload });
  },

  // Shop reports
  reportShop(slug, payload) {
    return request(`/customer/shops/${encodeURIComponent(slug)}/report`, { method: "POST", body: payload });
  },
  updateReview(reviewId, payload) {
    return request(`/customer/reviews/${reviewId}`, { method: "PUT", body: payload });
  },
  followUpReview(reviewId, content) {
    return request(`/customer/reviews/${reviewId}/follow-up`, { method: "POST", body: { content } });
  },
  deleteReview(reviewId) {
    return request(`/customer/reviews/${reviewId}`, { method: "DELETE" });
  },
  reportReview(reviewId, reason) {
    return request(`/customer/reviews/${reviewId}/report`, { method: "POST", body: { reason } });
  },

  // Reorder
  reorder(code) {
    return request(`/customer/orders/${encodeURIComponent(code)}/reorder`, { method: "POST" });
  },

  lookupSkus(skuIds) {
    return request(`/customer/skus/lookup`, { method: "POST", body: { skuIds } });
  },
};
