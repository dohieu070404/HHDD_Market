import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function SellerOrders() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await sellerApi.listOrders({ page: 1, limit: 50 });
      setItems(res.data.items || []);
    } catch (e) {
      setErr(e.message || "Không tải được đơn hàng")
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const actionsFor = useMemo(
    () => (order) => {
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
      if (!["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "RETURN_REQUESTED", "RETURNED"].includes(order.status)) {
        a.push({ key: "cancel", label: "Hủy", fn: () => sellerApi.cancelOrder(order.code, { reason: "Người bán hủy" }) });
      }
      return a;
    },
    []
  );

  async function runAction(fn) {
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message || "Thao tác thất bại")
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-bold">Đơn hàng</div>
          <div className="mt-1 text-sm text-slate-600">Xử lý đơn hàng theo trạng thái (demo).</div>
        </div>
        <button className="btn" onClick={load}>Tải lại</button>
      </div>

      {err ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{err}</div> : null}
      {loading ? <div className="mt-6 text-sm text-slate-600">Đang tải...</div> : null}

      {!loading ? (
        <div className="mt-6 card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Mã đơn</th>
                  <th className="px-4 py-3 text-left">Người mua</th>
                  <th className="px-4 py-3 text-left">Tổng</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.code}</div>
                      <div className="text-xs text-slate-600">{new Date(o.createdAt).toLocaleString("vi-VN")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{o.user?.username || "-"}</div>
                      <div className="text-xs text-slate-600">{o.user?.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatVND(o.total)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Link className="btn btn-ghost" to={`/seller/orders/${o.code}`}>Chi tiết</Link>
                        {actionsFor(o).slice(0, 3).map((a) => (
                          <button key={a.key} className="btn" onClick={() => runAction(a.fn)}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                      {actionsFor(o).length > 3 ? (
                        <div className="mt-2 text-xs text-slate-600">(Thêm thao tác ở chi tiết)</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-600" colSpan={5}>Chưa có đơn hàng.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
