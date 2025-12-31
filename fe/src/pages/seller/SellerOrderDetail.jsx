import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { sellerApi } from "../../api/seller";

import "./SellerOrderDetail.css";

function shippingStatusLabel(status) {
  const map = {
    PENDING: "Chờ lấy hàng",
    READY_TO_SHIP: "Sẵn sàng giao",
    SHIPPED: "Đã bàn giao vận chuyển",
    IN_TRANSIT: "Đang vận chuyển",
    DELIVERED: "Đã giao hàng",
    RETURNED: "Đã hoàn hàng",
  };
  return map[status] || status;
}



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
    <span className="badge badge-muted seller-order-detail__status">{label}</span>
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
      if (res?.success) {
        setOrder(res.data);
      } else {
        setOrder(null);
        setErr(res?.message || "Không tải được chi tiết đơn hàng");
      }
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
    if (["PACKING"].includes(order.status)) {
      a.push({ key: "ship", label: "Tạo vận đơn", fn: () => sellerApi.createShipment(order.code) });
    }
    if (order.shipment && ["SHIPPED"].includes(order.status)) {
      a.push({ key: "in_transit", label: "Cập nhật: Đang giao", fn: () => sellerApi.updateShipment(order.code, { status: "IN_TRANSIT", message: "Đang giao hàng" }) });
      a.push({ key: "delivered", label: "Cập nhật: Đã giao", fn: () => sellerApi.updateShipment(order.code, { status: "DELIVERED", message: "Đã giao hàng" }) });
    }
    if (order.status === "CANCEL_REQUESTED" && order.cancelRequest && order.cancelRequest.status === "REQUESTED") {
      a.push({ key: "cancel_approve", label: "Duyệt huỷ", variant: "danger", fn: () => sellerApi.approveCancel(order.code) });
      a.push({ key: "cancel_reject", label: "Từ chối huỷ", fn: () => sellerApi.rejectCancel(order.code) });
    }
    if (!order.shipment) {
      // no shipment yet
    }
    // Seller can only directly cancel orders in early states.
    const canSellerCancel = ["PENDING_PAYMENT", "PLACED", "CONFIRMED", "PACKING"].includes(order.status);
    if (canSellerCancel) {
      a.push({ key: "cancel", label: "Hủy", fn: () => sellerApi.cancelOrder(order.code, { reason: "Người bán hủy" }) });
    }
    return a;
  }, [order]);

  async function run(fn) {
    setErr("");
    try {
      const res = await fn();
      if (res && res.success === false) {
        setErr(res.message || "Thao tác thất bại");
      } else {
        await load();
      }
    } catch (e) {
      setErr(e.message || "Thao tác thất bại");
    }
  }

  return (
    <section className="seller-order-detail">
      <header className="seller-order-detail__header">
        <div>
          <h1 className="seller-order-detail__title">Đơn {code}</h1>
          <div className="seller-order-detail__meta muted">
            {order ? <StatusBadge status={order.status} /> : null}
            {order ? <span className="seller-order-detail__dot">•</span> : null}
            {order ? <span>{new Date(order.createdAt).toLocaleString("vi-VN")}</span> : null}
          </div>
        </div>
        <Link className="btn btn-ghost" to="/seller/orders">← Quay lại</Link>
      </header>

      {err ? <div className="alert alert--danger seller-order-detail__alert">{err}</div> : null}
      {loading ? <div className="seller-order-detail__loading muted">Đang tải...</div> : null}
      {!loading && !order ? <div className="seller-order-detail__empty muted">Không tìm thấy đơn.</div> : null}

      {order ? (
        <div className="seller-order-detail__grid">
          <div className="card seller-order-detail__products">
            <div className="seller-order-detail__sectionTitle">Sản phẩm</div>
            <div className="seller-order-detail__tableWrap">
              <table className="table table--tiki seller-order-detail__table">
                <thead>
                  <tr>
                    <th scope="col">Tên</th>
                    <th scope="col" className="seller-order-detail__thRight">SL</th>
                    <th scope="col" className="seller-order-detail__thRight">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <div className="seller-order-detail__productName">{it.name}</div>
                        <div className="seller-order-detail__productSku muted">SKU: {it.skuId}</div>
                      </td>
                      <td className="seller-order-detail__tdRight seller-order-detail__qty">{it.qty}</td>
                      <td className="seller-order-detail__tdRight seller-order-detail__price">{formatVND(it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="seller-order-detail__totalRow">
              <div className="seller-order-detail__totalLabel muted">Tổng</div>
              <div className="seller-order-detail__totalValue">{formatVND(order.total)}</div>
            </div>
          </div>

          <div className="card seller-order-detail__side">
            <div className="seller-order-detail__sectionTitle">Thao tác</div>
            <div className="seller-order-detail__actions">
              {actions.map((a) => (
                <button key={a.key} className={a.variant === "danger" ? "btn btn-danger" : "btn"} onClick={() => run(a.fn)}>
                  {a.label}
                </button>
              ))}
              {actions.length === 0 ? <div className="seller-order-detail__noActions muted">Không có thao tác phù hợp.</div> : null}
            </div>

            <div className="seller-order-detail__block">
              <div className="seller-order-detail__sectionTitle">Giao hàng</div>
              <div className="seller-order-detail__shipInfo">
                <div className="seller-order-detail__shipName">{order.shipFullName || "-"}</div>
                <div className="seller-order-detail__shipMuted muted">{order.shipPhone || ""}</div>
                <div className="seller-order-detail__shipMuted muted">
                  {order.shipLine1 || ""}{order.shipCity ? `, ${order.shipCity}` : ""}
                </div>
              </div>
            </div>

            {order.shipment ? (
              <div className="seller-order-detail__block">
                <div className="seller-order-detail__sectionTitle">Vận đơn</div>
                <div className="seller-order-detail__shipment muted">Mã: {order.shipment.trackingCode}</div>
                <div className="seller-order-detail__shipment muted">Trạng thái: {shippingStatusLabel(order.shipment.status)}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}