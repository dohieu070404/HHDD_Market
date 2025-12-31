import { useEffect, useMemo, useState } from "react";
import "./OrdersShared.css";
import "./OrderDetail.css";
import { Link, useParams } from "react-router-dom";
import { customerApi } from "../api/customer";
import { formatDateTime, formatPaymentMethod, formatVnd, shipmentStatusLabel } from "../utils/format";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";

export default function OrderDetail() {
  const { code } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [msg, setMsg] = useState(null); // {type:'ok'|'error', text}

  const canReview = useMemo(() => {
    // Allow review for delivered orders, and also when a return request was rejected
    // (the sale still stands).
    const s = String(order?.status || "");
    return ["DELIVERED", "COMPLETED", "RETURN_REJECTED"].includes(s);
  }, [order]);

  const canConfirm = useMemo(() => {
    // Backend allows confirm when SHIPPED/DELIVERED/DISPUTED.
    const s = String(order?.status || "");
    return ["SHIPPED", "DELIVERED", "DISPUTED"].includes(s);
  }, [order]);

  // Cancel logic aligned with backend:
  // - PENDING_PAYMENT / PLACED: free cancel
  // - CONFIRMED / PACKING / PACKED: send cancel request (seller must approve)
  // - Otherwise: cannot cancel
  const cancelMode = useMemo(() => {
    const s = String(order?.status || "");
    const cr = order?.cancelRequest;
    if (!s || s === "CANCELLED") return "NONE";

    // If a cancel request already exists, do not allow creating another one
    if (cr?.status === "REQUESTED") return "PENDING";
    if (cr?.status === "REJECTED") return "REJECTED";

    if (["PENDING_PAYMENT", "PLACED"].includes(s)) return "FREE";
    if (["CONFIRMED", "PACKING", "PACKED"].includes(s)) return "REQUEST";
    return "NONE";
  }, [order]);

  const canCancel = useMemo(() => cancelMode === "FREE" || cancelMode === "REQUEST", [cancelMode]);

  // Return/Refund request is only allowed after delivery (or during dispute) and only once.
  const canReturn = useMemo(() => {
    const s = String(order?.status || "");
    const okStatus = ["DELIVERED", "COMPLETED", "DISPUTED"].includes(s);
    // Backend blocks when a return/refund request already exists.
    const hasExisting = Boolean(order?.returnRequest || order?.refund);
    return okStatus && !hasExisting;
  }, [order]);

  const canRefund = canReturn;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await customerApi.getOrder(code);
      if (!res?.success) {
        setError(res?.message || "Không tải được đơn.");
        setLoading(false);
        return;
      }
      setOrder(res.data);
    } catch (e) {
      setError(e?.message || "Không tải được đơn.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChat() {
    setChatLoading(true);
    try {
      const res = await customerApi.getChat(code);
      if (res?.success) {
        setChatMessages(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (order?.code) loadChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.code]);

  async function doConfirm() {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await customerApi.confirmReceived(code);
      if (!res?.success) {
        setMsg({ type: "error", text: res?.message || "Không xác nhận được." });
        return;
      }
      setMsg({ type: "ok", text: "Đã xác nhận nhận hàng." });
      await load();
    } catch {
      setMsg({ type: "error", text: "Không xác nhận được." });
    } finally {
      setSubmitting(false);
    }
  }

  async function doCancel() {
    if (cancelReason.trim().length < 3) {
      setMsg({ type: "error", text: "Vui lòng nhập lý do (tối thiểu 3 ký tự)." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await customerApi.cancelRequest(code, cancelReason.trim());
      if (!res?.success) {
        setMsg({ type: "error", text: res?.message || "Không huỷ được." });
        return;
      }
      setCancelOpen(false);
      setCancelReason("");
      setMsg({ type: "ok", text: cancelMode === "FREE" ? "Đã huỷ đơn." : "Đã gửi yêu cầu huỷ." });
      await load();
    } catch {
      setMsg({ type: "error", text: "Không huỷ được." });
    } finally {
      setSubmitting(false);
    }
  }

  async function doReturn() {
    if (returnReason.trim().length < 3) {
      setMsg({ type: "error", text: "Vui lòng nhập lý do (tối thiểu 3 ký tự)." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await customerApi.returnRequest(code, returnReason.trim());
      if (!res?.success) {
        setMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu." });
        return;
      }
      setReturnOpen(false);
      setReturnReason("");
      setMsg({ type: "ok", text: "Đã gửi yêu cầu trả hàng/hoàn tiền." });
      await load();
    } catch {
      setMsg({ type: "error", text: "Không gửi được yêu cầu." });
    } finally {
      setSubmitting(false);
    }
  }

  async function doRefund() {
    if (refundReason.trim().length < 3) {
      setMsg({ type: "error", text: "Vui lòng nhập lý do (tối thiểu 3 ký tự)." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await customerApi.refundRequest(code, refundReason.trim());
      if (!res?.success) {
        setMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu." });
        return;
      }
      setRefundOpen(false);
      setRefundReason("");
      setMsg({ type: "ok", text: "Đã gửi yêu cầu hoàn tiền." });
      await load();
    } catch {
      setMsg({ type: "error", text: "Không gửi được yêu cầu." });
    } finally {
      setSubmitting(false);
    }
  }

  async function sendChat() {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    try {
      const res = await customerApi.sendChat(code, text);
      if (!res?.success) {
        setMsg({ type: "error", text: res?.message || "Không gửi được tin nhắn." });
        return;
      }
      await loadChat();
    } catch {
      setMsg({ type: "error", text: "Không gửi được tin nhắn." });
    }
  }

  if (loading) {
    return (
      <div className="order-detail-page">
        <div className="container-page order-detail-page__container">
          <div className="card order-detail-loadingCard">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-detail-page">
        <div className="container-page order-detail-page__container">
          <div className="card order-detail-errorCard">
            <div className="alert alert--danger">{error}</div>
            <div className="order-detail-errorCard__actions">
              <Link to="/orders" className="btn-secondary">
                Quay lại
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="order-detail-page">
      <div className="container-page order-detail-page__container">
        <Link to="/orders" className="order-detail__backLink">
          ← Quay lại danh sách
        </Link>

        <div className="order-detail-header">
          <div>
            <h1 className="order-detail-header__title">Đơn #{order.code}</h1>
            <div className="order-detail-header__shop muted">Shop: {order.shop?.name || ""}</div>
          </div>
          <div className="order-detail-header__right">
            <StatusBadge status={order.status} />
            <div className="order-detail-header__total">{formatVnd(order.total)}</div>
            <div className="order-detail-header__meta muted">{formatDateTime(order.createdAt)}</div>
            <div className="order-detail-header__meta muted">Thanh toán: {formatPaymentMethod(order.paymentMethod)}</div>
          </div>
        </div>

        {msg ? (
          <div className={`order-detail-msg ${msg.type === "error" ? "order-detail-msg--error" : "order-detail-msg--ok"}`}>
            {msg.text}
          </div>
        ) : null}

        <div className="order-detail-layout">
          <div className="order-detail-main">
            <div className="card order-detail-card">
              <div className="order-detail-card__title">Sản phẩm</div>

              <div className="order-detail-items">
                {(order.items || []).map((it) => (
                  <div key={it.id} className="orderItemRow order-detail-item">
                    <div className="orderThumb">
                      {it.product?.thumbnailUrl ? <img src={it.product.thumbnailUrl} alt={it.name} /> : <div className="thumb-fallback" />}
                    </div>

                    <div className="order-detail-item__content">
                      <div className="order-detail-item__row">
                        <div className="order-detail-item__left">
                          <div className="order-detail-item__name">{it.name}</div>
                          <div className="order-detail-item__meta muted">
                            {it.variantName ? `${it.variantName} · ` : ""}SL: {it.qty}
                          </div>

                          {canReview ? (
                            <div className="order-detail-item__actions">
                              {it.hasReview ? (
                                <span className="pill">Đã đánh giá</span>
                              ) : (
                                <Link
                                  to={`/reviews?order=${order.code}&productId=${encodeURIComponent(String(it.productId || it.product?.id || ""))}`}
                                  className="btn-secondary btn-sm"
                                >
                                  Đánh giá sản phẩm
                                </Link>
                              )}
                            </div>
                          ) : null}
                        </div>

                        <div className="order-detail-item__price">
                          <div className="order-detail-item__unit muted">{formatVnd(it.price)}</div>
                          <div className="order-detail-item__sum">{formatVnd(it.price * it.qty)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-detail-totals">
                <div className="order-detail-totals__row">
                  <div className="muted">Tạm tính</div>
                  <div>{formatVnd(order.subtotal)}</div>
                </div>
                <div className="order-detail-totals__row">
                  <div className="muted">Phí vận chuyển</div>
                  <div>{formatVnd(order.shippingFee)}</div>
                </div>
                {order.discount ? (
                  <div className="order-detail-totals__row">
                    <div className="muted">Giảm giá</div>
                    <div>-{formatVnd(order.discount)}</div>
                  </div>
                ) : null}
                <div className="order-detail-totals__row order-detail-totals__row--total">
                  <div>Tổng cộng</div>
                  <div>{formatVnd(order.total)}</div>
                </div>
              </div>
            </div>

            <div className="card order-detail-card">
              <div className="order-detail-card__title">Giao hàng</div>

              <div className="order-detail-ship">
                <div>
                  <span className="muted">Người nhận:</span> {order.shipFullName} · {order.shipPhone}
                </div>
                <div>
                  <span className="muted">Địa chỉ:</span> {order.shipLine1}
                  {order.shipLine2 ? `, ${order.shipLine2}` : ""}, {order.shipWard}, {order.shipDistrict}, {order.shipCity}
                </div>
                {order.shipProvince ? (
                  <div>
                    <span className="muted">Tỉnh/TP:</span> {order.shipProvince}
                  </div>
                ) : null}
                {order.shipPostalCode ? (
                  <div>
                    <span className="muted">Mã bưu chính:</span> {order.shipPostalCode}
                  </div>
                ) : null}
              </div>

              {order.shipment ? (
                <div className="order-detail-shipment">
                  <div className="order-detail-shipment__title">Vận đơn</div>
                  <div className="order-detail-shipment__meta">
                    <div>
                      <span className="muted">Mã vận đơn:</span> {order.shipment.trackingCode || "(chưa có)"}
                    </div>
                    <div>
                      <span className="muted">Trạng thái:</span> {shipmentStatusLabel(order.shipment.status)}
                    </div>
                  </div>

                  {order.shipment.events?.length ? (
                    <div className="order-detail-events">
                      {order.shipment.events.map((e) => (
                        <div key={e.id} className="order-detail-event">
                          <div className="order-detail-event__time muted">{formatDateTime(e.createdAt)}</div>
                          <div className="order-detail-event__text">
                            <b>{shipmentStatusLabel(e.status)}</b> — {e.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="order-detail-shipment__empty muted">Chưa có cập nhật vận chuyển.</div>
                  )}
                </div>
              ) : (
                <div className="order-detail-shipment__empty muted">Chưa tạo vận đơn.</div>
              )}
            </div>

            <div className="card order-detail-card">
              <div className="order-detail-card__title">Trao đổi với shop / CSKH</div>
              <div className="order-detail-chatHint muted">Tin nhắn chỉ hiển thị trong hệ thống demo.</div>

              <div className="order-detail-chatBox">
                {chatLoading ? (
                  <div className="muted">Đang tải tin nhắn...</div>
                ) : chatMessages.length ? (
                  <div className="order-detail-chatList">
                    {chatMessages.map((m) => (
                      <div key={m.id} className="order-detail-chatMsg">
                        <div className="order-detail-chatMsg__time muted">{formatDateTime(m.createdAt)}</div>
                        <div className="order-detail-chatMsg__text">{m.message}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted">Chưa có tin nhắn.</div>
                )}
              </div>

              <div className="order-detail-chatInput">
                <input
                  className="input order-detail-chatInput__field"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                />
                <button className="btn" onClick={sendChat} disabled={!chatText.trim()}>
                  Gửi
                </button>
              </div>
            </div>
          </div>

          <div className="order-action-stack">
            <div className="card action-card">
              <div className="action-card__title">Nhận hàng</div>
              <div className="action-card__hint">
                {canConfirm ? "Xác nhận khi bạn đã nhận đủ sản phẩm." : "Chỉ khả dụng khi đơn đang giao/đã giao."}
              </div>
              <button
                className="btn-secondary order-action__fullBtn"
                disabled={!canConfirm || submitting}
                onClick={doConfirm}
              >
                Xác nhận đã nhận hàng
              </button>
            </div>

            <div className="card action-card">
              <div className="action-card__title">
                {cancelMode === "FREE"
                  ? "Huỷ đơn"
                  : cancelMode === "REQUEST"
                  ? "Yêu cầu huỷ đơn"
                  : cancelMode === "REJECTED"
                  ? "Yêu cầu huỷ đã bị từ chối"
                  : "Huỷ đơn"}
              </div>
              <div className="action-card__hint">
                {cancelMode === "FREE"
                  ? "Bạn có thể huỷ tự do khi đơn đang chờ người bán xác nhận."
                  : cancelMode === "REQUEST"
                  ? "Đơn đang chuẩn bị. Bạn chỉ có thể gửi yêu cầu; shop cần xác nhận mới huỷ được."
                  : cancelMode === "PENDING"
                  ? "Đang chờ shop xử lý yêu cầu huỷ."
                  : cancelMode === "REJECTED"
                  ? "Shop đã từ chối yêu cầu huỷ. Bạn không thể gửi lại yêu cầu huỷ cho đơn này."
                  : "Trạng thái hiện tại không hỗ trợ huỷ."}
              </div>

              {cancelMode === "PENDING" ? (
                <div className="action-note order-detail-action-note">
                  <div className="order-detail-action-note__title">Yêu cầu đã gửi</div>
                  <div className="order-detail-action-note__meta muted">Lý do: {order?.cancelRequest?.reason || "(không có)"}</div>
                </div>
              ) : cancelMode === "REJECTED" ? (
                <div className="action-note order-detail-action-note">
                  <div className="order-detail-action-note__title">Yêu cầu đã bị từ chối</div>
                  <div className="order-detail-action-note__meta muted">Lý do bạn đã gửi: {order?.cancelRequest?.reason || "(không có)"}</div>
                </div>
              ) : (
                <button
                  className="btn-danger order-action__fullBtn"
                  disabled={!canCancel || cancelMode === "NONE" || submitting}
                  onClick={() => setCancelOpen(true)}
                >
                  {cancelMode === "FREE" ? "Huỷ đơn ngay" : "Gửi yêu cầu huỷ"}
                </button>
              )}
            </div>

            <div className="card action-card">
              <div className="action-card__title">Trả hàng / Hoàn tiền</div>
              <div className="action-card__hint">
                {order?.status === "CANCELLED"
                  ? "Đơn đã huỷ nên không thể tạo yêu cầu trả/hoàn."
                  : "Chỉ khả dụng sau khi đơn đã giao thành công."}
              </div>

              <div className="order-action__stackButtons">
                <button className="btn-secondary order-action__fullBtn" disabled={!canReturn || submitting} onClick={() => setReturnOpen(true)}>
                  Trả hàng/Hoàn tiền
                </button>
                <button className="btn-secondary order-action__fullBtn" disabled={!canRefund || submitting} onClick={() => setRefundOpen(true)}>
                  Hoàn tiền (không trả hàng)
                </button>
              </div>
            </div>

            <div className="card action-card">
              <div className="action-card__title">Hỗ trợ</div>
              <div className="action-card__hint">Khiếu nại được quản lý tại Trung tâm Khiếu nại để dễ theo dõi (giống các sàn).</div>
              <Link className="btn order-action__fullBtn" to={`/complaints?order=${encodeURIComponent(order?.code || "")}`}>
                Gửi khiếu nại
              </Link>
            </div>

            <div className="order-action-stack__footnote muted">
              * Luồng xử lý hủy/hoàn/hoàn tiền trong demo là mô phỏng để bạn test logic.
            </div>
          </div>
        </div>

        <Modal
          open={cancelOpen}
          title={cancelMode === "FREE" ? "Huỷ đơn hàng" : "Gửi yêu cầu huỷ"}
          onClose={() => (submitting ? null : setCancelOpen(false))}
          footer={
            <div className="order-detail-modal__footer">
              <button className="btn-secondary" onClick={() => setCancelOpen(false)} disabled={submitting}>
                Đóng
              </button>
              <button className="btn btn-primary" onClick={doCancel} disabled={submitting || cancelMode === "NONE" || !canCancel}>
                {submitting ? "Đang xử lý..." : cancelMode === "FREE" ? "Huỷ ngay" : "Gửi yêu cầu"}
              </button>
            </div>
          }
        >
          <div className="order-detail-modal__hint muted">
            {cancelMode === "FREE"
              ? "Bạn có thể huỷ tự do khi đơn đang chờ người bán xác nhận."
              : "Đơn đang chuẩn bị. Bạn chỉ có thể gửi yêu cầu; người bán cần xác nhận mới huỷ được."}
          </div>
          <textarea
            className="textarea order-detail-modal__textarea"
            rows={4}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={cancelMode === "FREE" ? "Lý do huỷ (tối thiểu 3 ký tự)..." : "Lý do yêu cầu huỷ (tối thiểu 3 ký tự)..."}
          />
        </Modal>

        <Modal
          open={returnOpen}
          title="Tạo yêu cầu Trả hàng/Hoàn tiền"
          onClose={() => (submitting ? null : setReturnOpen(false))}
          footer={
            <div className="order-detail-modal__footer">
              <button className="btn-secondary" onClick={() => setReturnOpen(false)} disabled={submitting}>
                Đóng
              </button>
              <button className="btn btn-primary" onClick={doReturn} disabled={submitting || !canReturn}>
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          }
        >
          <div className="order-detail-modal__hint muted">Yêu cầu trả hàng/hoàn tiền chỉ khả dụng sau khi đơn đã giao.</div>
          <textarea
            className="textarea order-detail-modal__textarea"
            rows={4}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Mô tả lý do và yêu cầu của bạn (tối thiểu 3 ký tự)..."
          />
        </Modal>

        <Modal
          open={refundOpen}
          title="Yêu cầu hoàn tiền (không trả hàng)"
          onClose={() => (submitting ? null : setRefundOpen(false))}
          footer={
            <div className="order-detail-modal__footer">
              <button className="btn-secondary" onClick={() => setRefundOpen(false)} disabled={submitting}>
                Đóng
              </button>
              <button className="btn btn-primary" onClick={doRefund} disabled={submitting || !canRefund}>
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          }
        >
          <div className="order-detail-modal__hint muted">Chỉ áp dụng sau khi đơn đã giao, khi bạn muốn hoàn tiền mà không trả hàng.</div>
          <textarea
            className="textarea order-detail-modal__textarea"
            rows={4}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Mô tả lý do (tối thiểu 3 ký tự)..."
          />
        </Modal>
      </div>
    </div>
  );
}
