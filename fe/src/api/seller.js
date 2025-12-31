import { request, requestFormData, getToken } from "./client";

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const sellerApi = {
  // Dashboard
  getDashboardKPI() {
    return request("/seller/dashboard/kpi");
  },

  // Finance
  getFinanceSummary() {
    return request("/seller/finance/summary");
  },

  // Shop settings
  getShop() {
    return request("/seller/shop");
  },
  updateShop(payload) {
    return request("/seller/shop", { method: "PUT", body: payload });
  },
  uploadShopLogo(file) {
    const fd = new FormData();
    fd.append("shopLogo", file);
    return requestFormData("/seller/shop/logo", { method: "POST", formData: fd });
  },

  // Shop addresses (pickup/return)
  listShopAddresses() {
    return request("/seller/shop/addresses");
  },
  createShopAddress(payload) {
    return request("/seller/shop/addresses", { method: "POST", body: payload });
  },
  updateShopAddress(id, payload) {
    return request(`/seller/shop/addresses/${id}`, { method: "PUT", body: payload });
  },
  deleteShopAddress(id) {
    return request(`/seller/shop/addresses/${id}`, { method: "DELETE" });
  },

  // Shipping config
  listShippingConfigs() {
    return request("/seller/shipping-config");
  },
  createShippingConfig(payload) {
    return request("/seller/shipping-config", { method: "POST", body: payload });
  },
  updateShippingConfig(id, payload) {
    return request(`/seller/shipping-config/${id}`, { method: "PUT", body: payload });
  },
  deleteShippingConfig(id) {
    return request(`/seller/shipping-config/${id}`, { method: "DELETE" });
  },

  // Products
  listProducts(params = {}) {
    return request(`/seller/products${toQuery(params)}`);
  },
  async downloadProductImportTemplate() {
    const token = getToken();
    const res = await fetch((import.meta.env.VITE_API_BASE_URL || "/api") + "/seller/products/import-template", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, status: res.status, message: text || `HTTP ${res.status}` };
    }
    const blob = await res.blob();
    return { success: true, data: blob };
  },
  importProductsExcel(file, mode = "upsert") {
    const fd = new FormData();
    fd.append("file", file);
    return requestFormData(`/seller/products/import-excel?mode=${encodeURIComponent(mode)}`, { method: "POST", formData: fd });
  },
  listCategories() {
    return request("/seller/categories");
  },
  createProduct(payload) {
    return request("/seller/products", { method: "POST", body: payload });
  },
  updateProduct(id, payload) {
    return request(`/seller/products/${id}`, { method: "PUT", body: payload });
  },
  setProductVisibility(id, status) {
    return request(`/seller/products/${id}/visibility`, { method: "POST", body: { status } });
  },
  deleteProduct(id) {
    return request(`/seller/products/${id}`, { method: "DELETE" });
  },
  listSkus(productId) {
    return request(`/seller/skus${toQuery({ productId })}`);
  },
  createSku(productId, payload) {
    return request(`/seller/products/${productId}/skus`, { method: "POST", body: payload });
  },
  updateSku(skuId, payload) {
    return request(`/seller/skus/${skuId}`, { method: "PUT", body: payload });
  },
  deleteSku(skuId) {
    return request(`/seller/skus/${skuId}`, { method: "DELETE" });
  },
  uploadProductImage(productId, payload) {
    return request(`/seller/products/${productId}/images`, { method: "POST", body: payload });
  },
  deleteProductImage(productId, imageId) {
    return request(`/seller/products/${productId}/images/${imageId}`, { method: "DELETE" });
  },

  // Orders
  listOrders(params = {}) {
    return request(`/seller/orders${toQuery(params)}`);
  },
  getOrder(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}`);
  },
  // Alias used by legacy pages
  orderDetail(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}`);
  },
  confirmOrder(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}/confirm`, { method: "POST" });
  },
  packOrder(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}/pack`, { method: "POST" });
  },
  createShipment(code, payload = {}) {
    return request(`/seller/orders/${encodeURIComponent(code)}/create-shipment`, { method: "POST", body: payload });
  },
  updateShipment(code, payload) {
    return request(`/seller/orders/${encodeURIComponent(code)}/update-shipment`, { method: "POST", body: payload });
  },
  cancelOrder(code, payload = {}) {
    return request(`/seller/orders/${encodeURIComponent(code)}/cancel`, { method: "POST", body: payload });
  },

  approveCancel(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}/cancel-approve`, { method: "POST" });
  },
  rejectCancel(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}/cancel-reject`, { method: "POST" });
  },

  // Chat
  getChat(code) {
    return request(`/seller/orders/${encodeURIComponent(code)}/chat`);
  },
  sendChat(code, message) {
    return request(`/seller/orders/${encodeURIComponent(code)}/chat`, { method: "POST", body: { message } });
  },

  // Reviews
  listReviews() {
    return request("/seller/reviews");
  },
  replyReview(reviewId, content) {
    return request(`/seller/reviews/${reviewId}/reply`, { method: "POST", body: { content } });
  },
  followUpReview(reviewId, content) {
    return request(`/seller/reviews/${reviewId}/follow-up`, { method: "POST", body: { content } });
  },
  reportReview(reviewId, reason) {
    return request(`/seller/reviews/${reviewId}/report`, { method: "POST", body: { reason } });
  },

  // Inventory
  listInventory(params = {}) {
    return request(`/seller/inventory${toQuery(params)}`);
  },
  inventoryAlerts(threshold = 5) {
    return request(`/seller/inventory/alerts${toQuery({ threshold })}`);
  },

  // Vouchers
  listVouchers() {
    return request("/seller/vouchers");
  },
  createVoucher(payload) {
    return request("/seller/vouchers", { method: "POST", body: payload });
  },
  updateVoucher(id, payload) {
    return request(`/seller/vouchers/${id}`, { method: "PUT", body: payload });
  },
  deleteVoucher(id) {
    return request(`/seller/vouchers/${id}`, { method: "DELETE" });
  },

  // Members
  listMembers() {
    return request("/seller/shop/members");
  },
  addMember(payload) {
    return request("/seller/shop/members", { method: "POST", body: payload });
  },
  updateMember(id, payload) {
    return request(`/seller/shop/members/${id}`, { method: "PUT", body: payload });
  },
  removeMember(id) {
    return request(`/seller/shop/members/${id}`, { method: "DELETE" });
  },

  // Returns / Refunds
  listReturnRequests() {
    return request("/seller/return-requests");
  },
  approveReturn(orderCode, payload = {}) {
    return request(`/seller/orders/${encodeURIComponent(orderCode)}/return-approve`, { method: "POST", body: payload });
  },
  rejectReturn(orderCode, reason) {
    return request(`/seller/orders/${encodeURIComponent(orderCode)}/return-reject`, { method: "POST", body: { reason } });
  },
  markReturnReceived(orderCode) {
    return request(`/seller/orders/${encodeURIComponent(orderCode)}/return-received`, { method: "POST" });
  },

  // Refund-only requests
  listRefundRequests() {
    return request("/seller/refund-requests");
  },
  approveRefund(orderCode) {
    return request(`/seller/orders/${encodeURIComponent(orderCode)}/refund-approve`, { method: "POST" });
  },
  rejectRefund(orderCode, reason) {
    return request(`/seller/orders/${encodeURIComponent(orderCode)}/refund-reject`, { method: "POST", body: { reason } });
  },

  // Shipping configs
  listShippingConfigs() {
    return request("/seller/shipping-config");
  },
  createShippingConfig(payload) {
    return request("/seller/shipping-config", { method: "POST", body: payload });
  },
  updateShippingConfig(id, payload) {
    return request(`/seller/shipping-config/${id}`, { method: "PUT", body: payload });
  },
  deleteShippingConfig(id) {
    return request(`/seller/shipping-config/${id}`, { method: "DELETE" });
  },

  // Shop addresses
  listShopAddresses() {
    return request("/seller/shop/addresses");
  },
  createShopAddress(payload) {
    return request("/seller/shop/addresses", { method: "POST", body: payload });
  },
  updateShopAddress(id, payload) {
    return request(`/seller/shop/addresses/${id}`, { method: "PUT", body: payload });
  },
  deleteShopAddress(id) {
    return request(`/seller/shop/addresses/${id}`, { method: "DELETE" });
  },

  // Disputes / complaints from customers
  listDisputes() {
    return request("/seller/disputes");
  },

  respondDispute(id, payload) {
    return request(`/seller/disputes/${id}/respond`, { method: "PUT", body: payload });
  },

  requestDisputeRevision(id, payload = {}) {
    return request(`/seller/disputes/${id}/request-revision`, { method: "POST", body: payload });
  },

  // Notifications (warnings from admin, etc.)
  listNotifications() {
    return request("/seller/notifications");
  },
  markNotificationRead(id) {
    return request(`/seller/notifications/${id}/read`, { method: "PUT" });
  },
};
