export function formatVND(amount) {
  const n = Number(amount || 0);
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

export function formatDateTime(iso) {
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

export function safeUpperInitial(text) {
  const s = String(text || "").trim();
  return s ? s[0].toUpperCase() : "?";
}
