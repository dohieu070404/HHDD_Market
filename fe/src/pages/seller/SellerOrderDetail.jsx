import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sellerApi } from "../../api/seller";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function StatusBadge({ status }) {
  const map = {
    PLACED: "Đã đặt",
    PENDING_PAYMENT: "Chờ thanh toán",
    CONFIRMED: "Đã xác nhận",
    PACKING: "Đang đóng gói",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    COMPLETED: "Hoàn tất",
    CANCEL_REQUESTED: "Yêu cầu hủy",
    CANCELLED: "Đã hủy",
    RETURN_REQUESTED: "Yêu cầu hoàn",
    RETURNED: "Đã hoàn",
  };
  const label = map[status] || status;
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold">
      {label}
    </span>
  );
}

export default function SellerOrderDetail() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await sellerApi.orderDetail(code);
      setOrder(res.data);
    } catch (e) {
      setErr(e.message || "Không tải được chi tiết đơn hàng");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [code]);

  const actions = useMemo(() => {
    if (!order) return [];
    const a = [];
    if (["PLACED", "PENDING_PAYMENT"].includes(order.status)) {
      a.push({ key: "confirm", label: "Xác nhận", fn: () => sellerApi.confirmOrder(order.code) });
    }
    if (["CONFIRMED"].includes(order.status)) {
      a.push({ key: "pack", label: "Đóng gói", fn: () => sellerApi.packOrder(order.code) });
    }
    if (["CONFIRMED", "PACKING"].includes(order.status)) {
      a.push({ key: "ship", label: "Tạo vận đơn", fn: () => sellerApi.createShipment(order.code) });
    }
    if (order.shipment && ["SHIPPED"].includes(order.status)) {
      a.push({ key: "in_transit", label: "Cập nhật: Đang giao", fn: () => sellerApi.updateShipment(order.code, { status: "IN_TRANSIT", message: "Đang giao hàng" }) });
      a.push({ key: "delivered", label: "Cập nhật: Đã giao", fn: () => sellerApi.updateShipment(order.code, { status: "DELIVERED", message: "Đã giao hàng" }) });
    }
    if (!order.shipment) {
      // no shipment yet
    }
    if (!order || !["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURN_REQUESTED", "RETURNED"].includes(order.status)) {
      a.push({ key: "cancel", label: "Hủy", fn: () => sellerApi.cancelOrder(order.code, { reason: "Người bán hủy" }) });
    }
    return a;
  }, [order]);

  async function run(fn) {
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message || "Thao tác thất bại");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-bold">Đơn {code}</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            {order ? <StatusBadge status={order.status} /> : null}
            {order ? <span>•</span> : null}
            {order ? <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span> : null}
          </div>
        </div>
        <Link className="btn btn-ghost" to="/seller/orders">
          ← Quay lại
        </Link>
      </div>

      {err ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{err}</div> : null}
      {loading ? <div className="mt-6 text-sm text-slate-600">Đang tải...</div> : null}
      {!loading && !order ? <div className="mt-6 text-sm text-slate-600">Không tìm thấy đơn.</div> : null}

      {order ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 card p-5">
            <div className="font-semibold">Sản phẩm</div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Tên</th>
                    <th className="px-3 py-2 text-right">SL</th>
                    <th className="px-3 py-2 text-right">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((it) => (
                    <tr key={it.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{it.name}</div>
                        <div className="text-xs text-slate-600">SKU: {it.skuId}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{it.qty}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatVND(it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-3">
              <div className="text-sm text-slate-600">Tổng</div>
              <div className="text-lg font-extrabold">{formatVND(order.total)}</div>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-semibold">Thao tác</div>
            <div className="mt-4 grid gap-2">
              {actions.map((a) => (
                <button key={a.key} className="btn" onClick={() => run(a.fn)}>
                  {a.label}
                </button>
              ))}
              {actions.length === 0 ? <div className="text-sm text-slate-600">Không có thao tác phù hợp.</div> : null}
            </div>

            <div className="mt-6">
              <div className="font-semibold">Giao hàng</div>
              <div className="mt-2 text-sm text-slate-700">
                {order.shippingFullName || "-"}
                <div className="text-slate-600">{order.shippingPhone || ""}</div>
                <div className="mt-2 text-slate-600">
                  {order.shippingAddressLine1 || ""}{order.shippingCity ? `, ${order.shippingCity}` : ""}
                </div>
              </div>
            </div>

            {order.shipment ? (
              <div className="mt-6">
                <div className="font-semibold">Vận đơn</div>
                <div className="mt-2 text-sm text-slate-600">Mã: {order.shipment.trackingNumber}</div>
                <div className="mt-2 text-sm text-slate-600">Trạng thái: {order.shipment.status}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
