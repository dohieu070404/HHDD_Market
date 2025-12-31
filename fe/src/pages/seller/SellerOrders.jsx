import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sellerApi } from "../../api/seller";

import "./SellerOrders.css";

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
    RETURN_REQUESTED: "Yêu cầu trả hàng",
    RETURN_APPROVED: "Đã duyệt trả hàng",
    RETURN_REJECTED: "Từ chối trả hàng",
    RETURN_RECEIVED: "Đã nhận hàng hoàn",
    REFUND_REQUESTED: "Yêu cầu hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
    DISPUTED: "Đang khiếu nại",
  };
  const label = map[status] || status;
  return (
    <span className="badge badge-muted seller-orders__status">{label}</span>
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
      // Seller can only directly cancel orders in early states.
      if (["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKING"].includes(order.status)) {
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
    <section className="seller-orders">
      <div className="seller-orders__header">
        <div>
          <h1 className="seller-orders__title">Đơn hàng</h1>
          <p className="seller-orders__subtitle muted">Xử lý đơn hàng theo trạng thái.</p>
        </div>
        <button className="btn btn-sm" onClick={load}>Tải lại</button>
      </div>

      {err ? <div className="alert alert--danger seller-orders__alert">{err}</div> : null}
      {loading ? <div className="seller-orders__loading muted">Đang tải...</div> : null}

      {!loading ? (
        <div className="card seller-orders__tableCard">
          <div className="seller-orders__tableWrap">
            <table className="table table--tiki table--fixed seller-orders__table">
              <thead>
                <tr>
                  <th scope="col">Mã đơn</th>
                  <th scope="col">Người mua</th>
                  <th scope="col">Tổng</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="seller-orders__thRight">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="seller-orders__code">{o.code}</div>
                      <div className="seller-orders__meta muted">{new Date(o.createdAt).toLocaleString("vi-VN")}</div>
                    </td>
                    <td>
                      <div className="seller-orders__buyer">{o.user?.username || "-"}</div>
                      <div className="seller-orders__meta muted">{o.user?.email || ""}</div>
                    </td>
                    <td className="seller-orders__total">{formatVND(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className="seller-orders__tdRight">
                      <div className="seller-orders__actions">
                        <Link className="btn btn-ghost btn-sm" to={`/seller/orders/${o.code}`}>Chi tiết</Link>
                        {actionsFor(o).slice(0, 3).map((a) => (
                          <button key={a.key} className="btn btn-sm" onClick={() => runAction(a.fn)}>{a.label}</button>
                        ))}
                      </div>
                      {actionsFor(o).length > 3 ? (
                        <div className="seller-orders__hint muted">(Thêm thao tác ở chi tiết)</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="seller-orders__empty muted">Chưa có đơn hàng.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
