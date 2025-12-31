/**
 * Format helpers (chuẩn hoá dùng toàn dự án)
 * - Ưu tiên: không throw, luôn trả string an toàn
 */

export function formatVND(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

/** CamelCase alias để tránh lỗi import/export (formatVnd) */
export function formatVnd(amount) {
  return formatVND(amount);
}

/** Format ngày dd/mm/yyyy */
export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Format ngày + giờ dd/mm/yyyy HH:mm */
export function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Map trạng thái đơn hàng -> label tiếng Việt */
export function formatOrderStatus(status) {
  const map = {
    PENDING_PAYMENT: "Chờ thanh toán",
    PLACED: "Đã đặt",
    CONFIRMED: "Đã xác nhận",
    PACKING: "Đang đóng gói",
    PACKED: "Đã đóng gói",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    COMPLETED: "Hoàn thành",
    CANCEL_REQUESTED: "Yêu cầu hủy",
    CANCELLED: "Đã hủy",
    RETURN_REQUESTED: "Yêu cầu hoàn/đổi",
    RETURN_APPROVED: "Đã duyệt hoàn/đổi",
    RETURN_REJECTED: "Từ chối hoàn/đổi",
    RETURN_RECEIVED: "Đã nhận hàng hoàn",
    REFUND_REQUESTED: "Yêu cầu hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
    DISPUTED: "Đang khiếu nại",
  };
  if (!status) return "";
  return map[String(status)] || String(status);
}

/** Map phương thức thanh toán -> label */
export function formatPaymentMethod(method) {
  const map = {
    COD: "Thanh toán khi nhận hàng (COD)",
    BANK_TRANSFER: "Chuyển khoản ngân hàng",
    MOCK_GATEWAY: "Cổng thanh toán demo",
  };
  if (!method) return "";
  return map[String(method)] || String(method);
}

/** Map trạng thái vận chuyển (shipment) -> label tiếng Việt */
export function shipmentStatusLabel(status) {
  const map = {
    PENDING: "Chờ lấy hàng",
    READY_TO_SHIP: "Sẵn sàng giao",
    SHIPPED: "Đã bàn giao vận chuyển",
    IN_TRANSIT: "Đang vận chuyển",
    DELIVERED: "Đã giao hàng",
    RETURNED: "Đã hoàn hàng",
    CANCELLED: "Đã hủy vận chuyển",
  };
  if (!status) return "";
  return map[String(status)] || String(status);
}

/** Alias cũ (nếu nơi khác import nhầm) */
export function shippingStatusLabel(status) {
  return shipmentStatusLabel(status);
}

/** Lấy chữ cái đầu cho avatar fallback */
export function safeUpperInitial(text) {
  const s = String(text || "").trim();
  return s ? s[0].toUpperCase() : "?";
}
