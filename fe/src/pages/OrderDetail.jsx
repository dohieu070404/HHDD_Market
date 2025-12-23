import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { customerApi } from "../api/customer";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function StatusBadge({ status }) {
  const map = {
    PLACED: "Đã đặt",
    CONFIRMED: "Đã xác nhận",
    PACKING: "Đang chuẩn bị",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    COMPLETED: "Hoàn tất",
    CANCEL_REQUESTED: "Yêu cầu hủy",
    CANCELLED: "Đã hủy",
    RETURN_REQUESTED: "Yêu cầu hoàn",
    RETURNED: "Đã hoàn",
    REFUND_REQUESTED: "Yêu cầu hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
  };
  const label = map[status] || status;
  const cls =
    status === "COMPLETED" || status === "DELIVERED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CANCELLED"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function OrderDetail() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  const [actionMsg, setActionMsg] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [disputeType, setDisputeType] = useState("DELIVERY");
  const [disputeMessage, setDisputeMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await customerApi.orderDetail(code);
      if (res?.success) {
        setOrder(res.data);
        setError(null);
      } else {
        setError(res?.message || "Không tải được đơn hàng");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    async function loadChat() {
      setChatLoading(true);
      try {
        const res = await customerApi.getChat(code);
        if (!cancelled) {
          setChatMessages(res?.success ? res.data : []);
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }
    if (code) loadChat();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const canCancel = useMemo(() => {
    if (!order) return false;
    return !["SHIPPED", "DELIVERED", "COMPLETED", "CANCELLED", "CANCEL_REQUESTED"].includes(order.status);
  }, [order]);

  const canConfirm = useMemo(() => {
    if (!order) return false;
    return ["SHIPPED", "DELIVERED"].includes(order.status);
  }, [order]);

  const canReturn = useMemo(() => {
    if (!order) return false;
    return ["DELIVERED", "COMPLETED"].includes(order.status) && order.status !== "RETURN_REQUESTED";
  }, [order]);

  async function doCancel() {
    if (!cancelReason || cancelReason.trim().length < 3) {
      setActionMsg({ type: "error", text: "Vui lòng nhập lý do (>= 3 ký tự)" });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await customerApi.cancelOrder(code, { reason: cancelReason.trim() });
      if (res?.success) {
        setCancelReason("");
        setActionMsg({ type: "success", text: "Đã gửi yêu cầu hủy" });
        await load();
      } else {
        setActionMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function doConfirm() {
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await customerApi.confirmReceived(code);
      if (res?.success) {
        setActionMsg({ type: "success", text: "Đã xác nhận nhận hàng" });
        await load();
      } else {
        setActionMsg({ type: "error", text: res?.message || "Không thực hiện được" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function doReturn() {
    if (!returnReason || returnReason.trim().length < 3) {
      setActionMsg({ type: "error", text: "Vui lòng nhập lý do (>= 3 ký tự)" });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await customerApi.returnOrder(code, { reason: returnReason.trim(), evidenceUrls: [] });
      if (res?.success) {
        setReturnReason("");
        setActionMsg({ type: "success", text: "Đã gửi yêu cầu hoàn/đổi" });
        await load();
      } else {
        setActionMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function doRefund() {
    if (!refundReason || refundReason.trim().length < 3) {
      setActionMsg({ type: "error", text: "Vui lòng nhập lý do (>= 3 ký tự)" });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await customerApi.refundRequest(code, refundReason.trim());
      if (res?.success) {
        setRefundReason("");
        setActionMsg({ type: "success", text: "Đã gửi yêu cầu hoàn tiền" });
        await load();
      } else {
        setActionMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function doDispute() {
    if (!disputeMessage || disputeMessage.trim().length < 10) {
      setActionMsg({ type: "error", text: "Nội dung khiếu nại tối thiểu 10 ký tự" });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await customerApi.createDispute(code, { type: disputeType, message: disputeMessage.trim() });
      if (res?.success) {
        setDisputeMessage("");
        setActionMsg({ type: "success", text: "Đã gửi khiếu nại" });
        await load();
      } else {
        setActionMsg({ type: "error", text: res?.message || "Không gửi được khiếu nại" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChat() {
    if (!chatText || chatText.trim().length < 1) return;
    const text = chatText.trim();
    setChatText("");
    try {
      const res = await customerApi.sendChatMessage(code, text);
      if (res?.success) {
        setChatMessages((prev) => [...prev, res.data]);
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="container-page py-10">
        <div className="card p-6">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-10">
        <div className="card p-6 text-red-600">{error}</div>
        <div className="mt-4"><Link to="/orders" className="btn-secondary">Quay lại</Link></div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="container-page py-8">
      <Link to="/orders" className="text-sm text-slate-600 hover:text-slate-900">← Quay lại danh sách</Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Đơn #{order.code}</h1>
          <div className="muted text-sm mt-1">{new Date(order.createdAt).toLocaleString("vi-VN")}</div>
        </div>
        <div className="text-right">
          <StatusBadge status={order.status} />
          <div className="mt-2 text-lg font-semibold">{formatVND(order.total)}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <h2 className="text-sm font-semibold">Sản phẩm</h2>
          <div className="mt-4 divide-y divide-slate-200">
            {(order.items || []).map((it) => (
              <div key={it.id} className="py-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{it.name}</div>
                  <div className="muted text-sm">x{it.qty}</div>
                </div>
                <div className="font-semibold">{formatVND(it.unitPrice * it.qty)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 flex items-center justify-between">
            <span className="font-medium">Tổng</span>
            <span className="text-lg font-semibold">{formatVND(order.total)}</span>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-semibold">Giao hàng</h2>
            <div className="mt-3 text-sm">
              <div className="font-medium">{order.shippingFullName}</div>
              <div className="muted">{order.shippingPhone}</div>
              <div className="mt-2 text-slate-700 whitespace-pre-line">{order.shippingAddressLine1}</div>
              <div className="muted">{order.shippingWard}, {order.shippingDistrict}, {order.shippingCity}</div>
            </div>

            {order.shipment ? (
              <div className="mt-4">
                <div className="text-sm font-semibold">Vận đơn</div>
                <div className="muted text-sm">{order.shipment.carrier || "Carrier"} - {order.shipment.trackingCode}</div>
                {(order.shipment.events || []).length ? (
                  <div className="mt-3 space-y-2">
                    {order.shipment.events.map((e) => (
                      <div key={e.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-sm font-medium">{e.status}</div>
                        <div className="muted text-xs">{new Date(e.createdAt).toLocaleString("vi-VN")}</div>
                        {e.note ? <div className="text-sm text-slate-700 mt-1">{e.note}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted text-sm mt-2">Chưa có cập nhật vận chuyển.</div>
                )}
              </div>
            ) : (
              <div className="muted text-sm mt-3">Chưa tạo vận đơn.</div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="text-sm font-semibold">Thao tác</h2>
            {actionMsg ? (
              <div className={"mt-3 text-sm " + (actionMsg.type === "error" ? "text-red-600" : "text-emerald-700")}>{actionMsg.text}</div>
            ) : null}

            {canConfirm ? (
              <button className="btn-primary mt-4 w-full" disabled={submitting} onClick={doConfirm}>
                Xác nhận đã nhận hàng
              </button>
            ) : null}

            {canCancel ? (
              <div className="mt-4">
                <div className="label mb-1">Yêu cầu hủy</div>
                <input className="input" placeholder="Lý do..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                <button className="btn-secondary mt-2 w-full" disabled={submitting} onClick={doCancel}>
                  Gửi yêu cầu hủy
                </button>
              </div>
            ) : null}

            {canReturn ? (
              <div className="mt-4">
                <div className="label mb-1">Yêu cầu hoàn/đổi</div>
                <input className="input" placeholder="Lý do..." value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
                <button className="btn-secondary mt-2 w-full" disabled={submitting} onClick={doReturn}>
                  Gửi yêu cầu hoàn/đổi
                </button>
              </div>
            ) : null}

            {!order.refundRequest ? (
              <div className="mt-4">
                <div className="label mb-1">Yêu cầu hoàn tiền</div>
                <input className="input" placeholder="Lý do..." value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                <button className="btn-secondary mt-2 w-full" disabled={submitting} onClick={doRefund}>
                  Gửi yêu cầu hoàn tiền
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="label mb-1">Hoàn tiền</div>
                <div className="muted text-sm">Bạn đã gửi yêu cầu hoàn tiền. Trạng thái: {order.refundRequest.status}</div>
              </div>
            )}

            {order.status !== "DISPUTED" ? (
              <div className="mt-4">
                <div className="label mb-1">Khiếu nại</div>
                <select className="input" value={disputeType} onChange={(e) => setDisputeType(e.target.value)}>
                  <option value="DELIVERY">Vận chuyển</option>
                  <option value="QUALITY">Chất lượng sản phẩm</option>
                  <option value="SCAM">Nghi ngờ gian lận</option>
                  <option value="OTHER">Khác</option>
                </select>
                <textarea
                  className="input mt-2 min-h-[90px]"
                  placeholder="Mô tả vấn đề..."
                  value={disputeMessage}
                  onChange={(e) => setDisputeMessage(e.target.value)}
                />
                <button className="btn-secondary mt-2 w-full" disabled={submitting} onClick={doDispute}>
                  Gửi khiếu nại
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <div className="label mb-1">Khiếu nại</div>
                <div className="muted text-sm">Đơn hàng đang ở trạng thái tranh chấp.</div>
              </div>
            )}
          </div>

          <div className="card p-6 mt-6">
            <h2 className="text-sm font-semibold">Nhắn tin với Shop</h2>
            <div className="muted text-sm mt-1">Tin nhắn sẽ được lưu theo từng đơn hàng.</div>

            <div className="mt-4 max-h-64 overflow-auto space-y-3">
              {chatLoading ? (
                <div className="muted text-sm">Đang tải...</div>
              ) : chat.length === 0 ? (
                <div className="muted text-sm">Chưa có tin nhắn.</div>
              ) : (
                chat.map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{m.sender?.username || "User"}</span>
                      <span className="mx-2">•</span>
                      {m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : ""}
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap">{m.message}</div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <textarea
                className="input min-h-[90px]"
                placeholder="Nhập tin nhắn..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
              <button className="btn-primary mt-2 w-full" disabled={submitting} onClick={sendChat}>
                Gửi tin nhắn
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
