import { formatOrderStatus, shipmentStatusLabel } from "../../utils/format";

function toneFromStatus(status) {
  if (!status) return "gray";
  if (status === "DELIVERED" || status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status.startsWith("RETURN_") || status.startsWith("REFUND")) return "warning";
  if (status === "SHIPPED" || status === "IN_TRANSIT") return "info";
  return "gray";
}

export default function StatusBadge({ status, variant = "order" }) {
  const label =
    variant === "shipment"
      ? shipmentStatusLabel(status) || status
      : formatOrderStatus(status) || status;

  const tone = toneFromStatus(status);
  const cls =
    tone === "gray"
      ? "badge badge--gray"
      : tone === "info"
      ? "badge badge--info"
      : tone === "success"
      ? "badge badge--success"
      : tone === "warning"
      ? "badge badge--warning"
      : "badge badge--danger";

  return <span className={cls}>{label}</span>;
}
