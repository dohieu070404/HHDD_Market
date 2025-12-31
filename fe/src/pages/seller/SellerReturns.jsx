import { useEffect, useMemo, useState } from "react";
import Skeleton from "../../components/ui/Skeleton";
import { sellerApi } from "../../api/seller";
import { formatDateTime, formatVnd } from "../../utils/format";

import "./SellerReturns.css";

function Badge({ status }) {
  const map = {
    // Return status
    REQUESTED: "badge badge--warning",
    APPROVED: "badge badge--success",
    REJECTED: "badge badge--danger",
    RECEIVED: "badge",
    CLOSED: "badge",
    // Refund status
    PROCESSING: "badge badge--warning",
    SUCCESS: "badge badge--success",
    FAILED: "badge badge--danger",
  };
  return <span className={map[status] || "badge"}>{status}</span>;
}

function ReturnsModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className="modal seller-returns__modal">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Đóng" type="button">
            Đóng
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function SellerReturns() {
  const [view, setView] = useState("RETURN"); // RETURN | REFUND

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [returnItems, setReturnItems] = useState([]);
  const [refundItems, setRefundItems] = useState([]);

  const [returnFilter, setReturnFilter] = useState("ALL");
  const [refundFilter, setRefundFilter] = useState("ALL");

  // --- Return approve modal ---
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const [resolution, setResolution] = useState("BUYER_FAULT");
  const [shippingPayer, setShippingPayer] = useState("BUYER");
  const [restockingFee, setRestockingFee] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [decisionNote, setDecisionNote] = useState("");

  // --- Return reject modal ---
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // --- Refund approve modal ---
  const [refundApproveOpen, setRefundApproveOpen] = useState(false);
  const [refundApproveTarget, setRefundApproveTarget] = useState(null);
  const [refundApproveSubmitting, setRefundApproveSubmitting] = useState(false);

  // --- Refund reject modal ---
  const [refundRejectOpen, setRefundRejectOpen] = useState(false);
  const [refundRejectTarget, setRefundRejectTarget] = useState(null);
  const [refundRejectReason, setRefundRejectReason] = useState("");
  const [refundRejectSubmitting, setRefundRejectSubmitting] = useState(false);

  const currentItems = view === "RETURN" ? returnItems : refundItems;
  const currentFilter = view === "RETURN" ? returnFilter : refundFilter;

  const filtered = useMemo(() => {
    if (currentFilter === "ALL") return currentItems;
    return currentItems.filter((x) => x.status === currentFilter);
  }, [currentItems, currentFilter]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [returnsRes, refundsRes] = await Promise.all([
        sellerApi.listReturnRequests(),
        sellerApi.listRefundRequests(),
      ]);

      if (!returnsRes?.success) throw new Error(returnsRes?.message || "Không tải được yêu cầu hoàn/đổi");
      setReturnItems(returnsRes.data || []);

      if (!refundsRes?.success) throw new Error(refundsRes?.message || "Không tải được yêu cầu hoàn tiền");
      setRefundItems(refundsRes.data || []);
    } catch (e) {
      setError(e?.message || "Không tải được dữ liệu Trả hàng/Hoàn tiền");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Return actions ---
  function openApprove(rr) {
    setApproveTarget(rr);

    const guessType = String(rr.requestType || "").toUpperCase();
    const isSellerFault = ["DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED"].includes(guessType);

    const defaultResolution = isSellerFault ? "SELLER_FAULT" : "BUYER_FAULT";
    setResolution(defaultResolution);
    setShippingPayer(isSellerFault ? "SELLER" : "BUYER");

    const orderTotal = Number(rr.order?.total || 0);
    const suggestedFee = isSellerFault ? 0 : Math.min(Math.round(orderTotal * 0.05), 50000);
    setRestockingFee(suggestedFee);
    setRefundAmount(Math.max(0, orderTotal - suggestedFee));

    setDecisionNote(rr.decisionNote || "");
    setApproveOpen(true);
  }

  function openReject(rr) {
    setRejectTarget(rr);
    setRejectReason(rr.decisionNote || "");
    setRejectOpen(true);
  }

  async function submitApprove() {
    if (!approveTarget) return;
    setApproveSubmitting(true);
    try {
      const orderCode = approveTarget.order?.code;
      const total = Number(approveTarget.order?.total || 0);
      const fee = Math.max(0, Number(restockingFee || 0));
      const amt = Math.max(0, Math.min(total, Number(refundAmount || 0)));

      const res = await sellerApi.approveReturn(orderCode, {
        resolution,
        shippingPayer,
        restockingFee: fee,
        refundAmount: amt,
        decisionNote: decisionNote.trim() || undefined,
      });
      if (!res?.success) throw new Error(res?.message || "Không duyệt được yêu cầu");
      setApproveOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Không duyệt được yêu cầu");
    } finally {
      setApproveSubmitting(false);
    }
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      alert("Vui lòng nhập lý do (tối thiểu 3 ký tự)");
      return;
    }
    setRejectSubmitting(true);
    try {
      const orderCode = rejectTarget.order?.code;
      const res = await sellerApi.rejectReturn(orderCode, reason);
      if (!res?.success) throw new Error(res?.message || "Không từ chối được yêu cầu");
      setRejectOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Không từ chối được yêu cầu");
    } finally {
      setRejectSubmitting(false);
    }
  }

  async function markReceived(rr) {
    if (!window.confirm("Xác nhận shop đã nhận được hàng hoàn và xử lý hoàn tiền?")) return;
    try {
      const res = await sellerApi.markReturnReceived(rr.order?.code);
      if (!res?.success) throw new Error(res?.message || "Không cập nhật được");
      await load();
    } catch (e) {
      alert(e?.message || "Không cập nhật được");
    }
  }

  // --- Refund-only actions ---
  function openRefundApprove(rf) {
    setRefundApproveTarget(rf);
    setRefundApproveOpen(true);
  }

  function openRefundReject(rf) {
    setRefundRejectTarget(rf);
    setRefundRejectReason("");
    setRefundRejectOpen(true);
  }

  async function submitRefundApprove() {
    if (!refundApproveTarget) return;
    setRefundApproveSubmitting(true);
    try {
      const orderCode = refundApproveTarget.order?.code;
      const res = await sellerApi.approveRefund(orderCode);
      if (!res?.success) throw new Error(res?.message || "Không xử lý được hoàn tiền");
      setRefundApproveOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Không xử lý được hoàn tiền");
    } finally {
      setRefundApproveSubmitting(false);
    }
  }

  async function submitRefundReject() {
    if (!refundRejectTarget) return;
    const reason = refundRejectReason.trim();
    if (reason.length < 3) {
      alert("Vui lòng nhập lý do (tối thiểu 3 ký tự)");
      return;
    }
    setRefundRejectSubmitting(true);
    try {
      const orderCode = refundRejectTarget.order?.code;
      const res = await sellerApi.rejectRefund(orderCode, reason);
      if (!res?.success) throw new Error(res?.message || "Không từ chối được hoàn tiền");
      setRefundRejectOpen(false);
      await load();
    } catch (e) {
      alert(e?.message || "Không từ chối được hoàn tiền");
    } finally {
      setRefundRejectSubmitting(false);
    }
  }

  return (
    <section className="seller-returns">
      <header className="seller-returns__header">
        <div>
          <h1 className="seller-returns__title">Trả hàng / Hoàn tiền</h1>
          <p className="seller-returns__subtitle muted">Duyệt yêu cầu, áp dụng chính sách và xử lý hoàn tiền.</p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading} type="button">
          Làm mới
        </button>
      </header>

      {/* View switch */}
      <div className="seller-returns__filters" role="tablist" aria-label="Return/Refund view">
        {[
          ["RETURN", "Trả hàng/Hoàn tiền"],
          ["REFUND", "Hoàn tiền (không trả hàng)"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={"seller-returns__pill " + (view === k ? "seller-returns__pill--active" : "")}
            onClick={() => setView(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status filters */}
      <div className="seller-returns__filters" role="tablist" aria-label="Filters">
        {view === "RETURN"
          ? [
              ["ALL", "Tất cả"],
              ["REQUESTED", "Chờ xử lý"],
              ["APPROVED", "Đã duyệt"],
              ["REJECTED", "Đã từ chối"],
              ["RECEIVED", "Đã nhận"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={"seller-returns__pill " + (returnFilter === k ? "seller-returns__pill--active" : "")}
                onClick={() => setReturnFilter(k)}
              >
                {label}
              </button>
            ))
          : [
              ["ALL", "Tất cả"],
              ["REQUESTED", "Chờ xử lý"],
              ["SUCCESS", "Đã hoàn"],
              ["FAILED", "Thất bại"],
              ["REJECTED", "Đã từ chối"],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={"seller-returns__pill " + (refundFilter === k ? "seller-returns__pill--active" : "")}
                onClick={() => setRefundFilter(k)}
              >
                {label}
              </button>
            ))}
      </div>

      <div className="card seller-returns__card">
        {loading ? (
          <div className="seller-returns__loading">
            <Skeleton style={{ height: 16, width: 220 }} />
            <Skeleton style={{ height: 48, width: "100%", marginTop: 10 }} />
            <Skeleton style={{ height: 48, width: "100%", marginTop: 10 }} />
            <Skeleton style={{ height: 48, width: "100%", marginTop: 10 }} />
          </div>
        ) : error ? (
          <div className="alert alert--danger">{error}</div>
        ) : !filtered.length ? (
          <div className="seller-returns__empty">Chưa có yêu cầu nào.</div>
        ) : (
          <div className="seller-returns__tableWrap">
            {view === "RETURN" ? (
              <table className="table table--tiki seller-returns__table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th>Loại</th>
                    <th>Lý do</th>
                    <th>Tổng</th>
                    <th>Trạng thái</th>
                    <th className="seller-returns__thRight">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rr) => (
                    <tr key={rr.id}>
                      <td>
                        <div className="seller-returns__code">{rr.order?.code}</div>
                        <div className="seller-returns__date muted">{formatDateTime(rr.createdAt)}</div>
                      </td>
                      <td>{rr.user?.username || rr.userId}</td>
                      <td className="muted">{rr.requestType || "—"}</td>
                      <td className="muted">
                        <div className="seller-returns__clamp">{rr.reason}</div>
                        {rr.decisionNote ? <div className="seller-returns__note">📝 {rr.decisionNote}</div> : null}
                      </td>
                      <td className="seller-returns__total">{formatVnd(rr.order?.total || 0)}</td>
                      <td>
                        <Badge status={rr.status} />
                      </td>
                      <td className="seller-returns__tdRight">
                        <div className="seller-returns__rowActions">
                          {rr.status === "REQUESTED" ? (
                            <>
                              <button className="btn btn-sm" onClick={() => openApprove(rr)} type="button">
                                Duyệt
                              </button>
                              <button className="btn-secondary btn-sm" onClick={() => openReject(rr)} type="button">
                                Từ chối
                              </button>
                            </>
                          ) : null}
                          {rr.status === "APPROVED" ? (
                            <button className="btn btn-sm" onClick={() => markReceived(rr)} type="button">
                              Đã nhận hàng
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="table table--tiki seller-returns__table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th>Lý do</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                    <th className="seller-returns__thRight">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rf) => (
                    <tr key={rf.id}>
                      <td>
                        <div className="seller-returns__code">{rf.order?.code}</div>
                        <div className="seller-returns__date muted">{formatDateTime(rf.createdAt)}</div>
                      </td>
                      <td>{rf.order?.user?.username || rf.order?.userId || "-"}</td>
                      <td className="muted">
                        <div className="seller-returns__clamp">{rf.reason || "(không có)"}</div>
                        {rf.status === "FAILED" ? (
                          <div className="seller-returns__note">⚠️ Hoàn tiền tự động thất bại (có thể do COD/chưa thanh toán).</div>
                        ) : null}
                      </td>
                      <td className="seller-returns__total">{formatVnd(rf.amount || 0)}</td>
                      <td>
                        <Badge status={rf.status} />
                      </td>
                      <td className="seller-returns__tdRight">
                        <div className="seller-returns__rowActions">
                          {rf.status === "REQUESTED" || rf.status === "FAILED" ? (
                            <button className="btn btn-sm" onClick={() => openRefundApprove(rf)} type="button">
                              {rf.status === "FAILED" ? "Thử hoàn lại" : "Duyệt"}
                            </button>
                          ) : null}
                          {rf.status === "REQUESTED" ? (
                            <button className="btn-secondary btn-sm" onClick={() => openRefundReject(rf)} type="button">
                              Từ chối
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Return approve modal */}
      <ReturnsModal
        open={approveOpen}
        title={approveTarget ? `Duyệt hoàn/đổi: ${approveTarget.order?.code}` : "Duyệt hoàn/đổi"}
        onClose={() => (approveSubmitting ? null : setApproveOpen(false))}
        footer={
          <div className="seller-returns__modalActions">
            <button className="btn-secondary" disabled={approveSubmitting} onClick={() => setApproveOpen(false)} type="button">
              Hủy
            </button>
            <button className="btn" disabled={approveSubmitting} onClick={submitApprove} type="button">
              {approveSubmitting ? "Đang lưu..." : "Xác nhận duyệt"}
            </button>
          </div>
        }
      >
        <div className="seller-returns__form">
          <div className="seller-returns__field">
            <div className="seller-returns__subLabel muted">Trách nhiệm</div>
            <select className="select" value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="BUYER_FAULT">Khách đổi ý / Không lỗi shop</option>
              <option value="SELLER_FAULT">Shop giao sai / Hàng lỗi / Không đúng mô tả</option>
            </select>
            <div className="seller-returns__hint muted">Gợi ý: nếu khách đổi ý, có thể áp dụng phí hoàn hàng để tránh shop chịu thiệt.</div>
          </div>

          <div className="seller-returns__field">
            <div className="seller-returns__subLabel muted">Ai trả phí vận chuyển hoàn</div>
            <select className="select" value={shippingPayer} onChange={(e) => setShippingPayer(e.target.value)}>
              <option value="BUYER">Khách hàng</option>
              <option value="SELLER">Shop</option>
            </select>
          </div>

          <div className="seller-returns__grid2">
            <div className="seller-returns__field">
              <div className="seller-returns__subLabel muted">Phí xử lý/khấu trừ (VND)</div>
              <input className="input" type="number" min={0} value={restockingFee} onChange={(e) => setRestockingFee(Number(e.target.value))} />
            </div>
            <div className="seller-returns__field">
              <div className="seller-returns__subLabel muted">Số tiền hoàn (VND)</div>
              <input className="input" type="number" min={0} value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value))} />
            </div>
          </div>

          <div className="seller-returns__field">
            <div className="seller-returns__subLabel muted">Ghi chú</div>
            <textarea
              className="textarea seller-returns__textarea"
              rows={3}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Ví dụ: chấp nhận hoàn theo chính sách đổi ý, khấu trừ phí xử lý..."
            />
          </div>
        </div>
      </ReturnsModal>

      {/* Return reject modal */}
      <ReturnsModal
        open={rejectOpen}
        title={rejectTarget ? `Từ chối yêu cầu: ${rejectTarget.order?.code}` : "Từ chối yêu cầu"}
        onClose={() => (rejectSubmitting ? null : setRejectOpen(false))}
        footer={
          <div className="seller-returns__modalActions">
            <button className="btn-secondary" disabled={rejectSubmitting} onClick={() => setRejectOpen(false)} type="button">
              Hủy
            </button>
            <button className="btn" disabled={rejectSubmitting} onClick={submitReject} type="button">
              {rejectSubmitting ? "Đang gửi..." : "Xác nhận từ chối"}
            </button>
          </div>
        }
      >
        <div className="seller-returns__form">
          <div className="seller-returns__subLabel muted">Lý do từ chối</div>
          <textarea
            className="textarea seller-returns__textarea"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ví dụ: quá thời hạn trả hàng, thiếu bằng chứng, sản phẩm đã qua sử dụng..."
          />
        </div>
      </ReturnsModal>

      {/* Refund approve modal */}
      <ReturnsModal
        open={refundApproveOpen}
        title={refundApproveTarget ? `Duyệt hoàn tiền: ${refundApproveTarget.order?.code}` : "Duyệt hoàn tiền"}
        onClose={() => (refundApproveSubmitting ? null : setRefundApproveOpen(false))}
        footer={
          <div className="seller-returns__modalActions">
            <button className="btn-secondary" disabled={refundApproveSubmitting} onClick={() => setRefundApproveOpen(false)} type="button">
              Hủy
            </button>
            <button className="btn" disabled={refundApproveSubmitting} onClick={submitRefundApprove} type="button">
              {refundApproveSubmitting ? "Đang xử lý..." : "Xác nhận duyệt"}
            </button>
          </div>
        }
      >
        <div className="seller-returns__form">
          <div className="muted">
            Xác nhận duyệt yêu cầu hoàn tiền (không trả hàng). Hệ thống sẽ cố gắng hoàn tiền tự động theo giao dịch đã thanh toán.
          </div>
          <div>
            <div><b>Mã đơn:</b> {refundApproveTarget?.order?.code}</div>
            <div><b>Số tiền:</b> {formatVnd(refundApproveTarget?.amount || 0)}</div>
            <div><b>Lý do:</b> {refundApproveTarget?.reason || "(không có)"}</div>
          </div>
          <div className="muted">* Nếu đơn là COD/chưa thanh toán, hoàn tự động có thể thất bại và cần xử lý thủ công.</div>
        </div>
      </ReturnsModal>

      {/* Refund reject modal */}
      <ReturnsModal
        open={refundRejectOpen}
        title={refundRejectTarget ? `Từ chối hoàn tiền: ${refundRejectTarget.order?.code}` : "Từ chối hoàn tiền"}
        onClose={() => (refundRejectSubmitting ? null : setRefundRejectOpen(false))}
        footer={
          <div className="seller-returns__modalActions">
            <button className="btn-secondary" disabled={refundRejectSubmitting} onClick={() => setRefundRejectOpen(false)} type="button">
              Hủy
            </button>
            <button className="btn" disabled={refundRejectSubmitting} onClick={submitRefundReject} type="button">
              {refundRejectSubmitting ? "Đang gửi..." : "Xác nhận từ chối"}
            </button>
          </div>
        }
      >
        <div className="seller-returns__form">
          <div className="seller-returns__subLabel muted">Lý do từ chối</div>
          <textarea
            className="textarea seller-returns__textarea"
            rows={4}
            value={refundRejectReason}
            onChange={(e) => setRefundRejectReason(e.target.value)}
            placeholder="Ví dụ: không đủ bằng chứng, quá thời hạn, sản phẩm đúng mô tả..."
          />
        </div>
      </ReturnsModal>
    </section>
  );
}
