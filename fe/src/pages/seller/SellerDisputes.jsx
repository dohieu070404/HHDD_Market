import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { sellerApi } from "../../api/seller";
import { formatDateTime, formatOrderStatus } from "../../utils/format";
import Skeleton from "../../components/ui/Skeleton";

import "./SellerDisputes.css";

function StatusPill({ status }) {
  const map = {
    OPEN: { label: "Mới", cls: "badge badge--warning" },
    UNDER_REVIEW: { label: "Đang xử lý", cls: "badge badge--warning" },
    RESOLVED: { label: "Đã giải quyết", cls: "badge badge--success" },
    REJECTED: { label: "Từ chối", cls: "badge badge--danger" },
  };
  const v = map[status] || { label: status || "-", cls: "badge" };
  return <span className={v.cls}>{v.label}</span>;
}

function canRequestRevision(dispute) {
  const isFinal = dispute?.status === "RESOLVED" || dispute?.status === "REJECTED";
  const editCount = Number(dispute?.editCount || 0);
  return isFinal && editCount < 1 && !dispute?.revisionRequestedAt;
}

function DisputesModal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className="modal seller-disputes__modal">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="btn-outline" onClick={onClose} type="button">
            Đóng
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export default function SellerDisputes() {
  const [searchParams] = useSearchParams();
  const preselectDisputeId = useMemo(() => {
    const raw = searchParams.get("dispute") || searchParams.get("id");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [searchParams]);
  const didAutoOpen = useRef(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [revNote, setRevNote] = useState("");
  const [revSending, setRevSending] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await sellerApi.listDisputes();
      if (res?.success) {
        const data = res.data || [];
        setItems(data);

        if (preselectDisputeId && !didAutoOpen.current) {
          const found = (data || []).find((d) => Number(d.id) === Number(preselectDisputeId));
          if (found) {
            didAutoOpen.current = true;
            openDetail(found);
          }
        }
      }
      else setErr(res?.message || "Không tải được khiếu nại");
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Không tải được khiếu nại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return items;
    return (items || []).filter((x) => x.status === statusFilter);
  }, [items, statusFilter]);

  function openDetail(d) {
    setSelected(d);
    setReply(d.sellerResponse || "");
    setRevNote("");
    setOpen(true);
  }

  async function sendReply() {
    if (!selected) return;
    if (!reply || reply.trim().length < 5) {
      alert("Vui lòng nhập phản hồi (tối thiểu 5 ký tự)");
      return;
    }

    setSending(true);
    try {
      const res = await sellerApi.respondDispute(selected.id, { message: reply.trim() });
      if (res?.success) {
        await load();
        setOpen(false);
        setSelected(null);
        setReply("");
      } else {
        alert(res?.message || "Gửi phản hồi thất bại");
      }
    } catch (e) {
      alert(e?.data?.message || "Gửi phản hồi thất bại");
    } finally {
      setSending(false);
    }
  }

  async function requestRevision() {
    if (!selected) return;
    setRevSending(true);
    try {
      const payload = revNote?.trim() ? { note: revNote.trim() } : {};
      const res = await sellerApi.requestDisputeRevision(selected.id, payload);
      if (res?.success) {
        await load();
        setOpen(false);
        setSelected(null);
        setRevNote("");
      } else {
        alert(res?.message || "Gửi yêu cầu xem lại thất bại");
      }
    } catch (e) {
      alert(e?.data?.message || e?.message || "Gửi yêu cầu xem lại thất bại");
    } finally {
      setRevSending(false);
    }
  }

  return (
    <section>
      <div className="seller-disputes__header">
        <div>
          <h1 className="seller-disputes__title">Khiếu nại từ khách hàng</h1>
          <p className="seller-disputes__subtitle muted">Xem và phản hồi khiếu nại. Phản hồi sẽ được gửi tới khách hàng (notification).</p>
        </div>
        <div className="seller-disputes__controls">
          <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tất cả</option>
            <option value="OPEN">Mới</option>
            <option value="UNDER_REVIEW">Đang xử lý</option>
            <option value="RESOLVED">Đã giải quyết</option>
            <option value="REJECTED">Từ chối</option>
          </select>
          <button className="btn-secondary" onClick={load} type="button">
            Tải lại
          </button>
        </div>
      </div>

      {err ? <div className="alert alert--error seller-disputes__alert">{err}</div> : null}

      <div className="seller-disputes__list">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card seller-disputes__skeletonCard">
              <Skeleton style={{ width: 240, height: 14 }} />
              <div className="seller-disputes__spacer" />
              <Skeleton style={{ width: "80%", height: 12 }} />
              <div className="seller-disputes__spacer" />
              <Skeleton style={{ width: 160, height: 12 }} />
            </div>
          ))
        ) : filtered?.length ? (
          filtered.map((d) => (
            <article key={d.id} className="card seller-disputes__card">
              <div className="seller-disputes__top">
                <div className="seller-disputes__topLeft">
                  <div className="seller-disputes__subject">
                    Đơn {d.order?.code} • {d.user?.username || d.user?.email || "Khách"}
                  </div>
                  <div className="seller-disputes__meta muted">
                    Tạo lúc {formatDateTime(d.createdAt)} • Trạng thái đơn: {formatOrderStatus(d.order?.status)}
                    {Array.isArray(d.mediaUrls) && d.mediaUrls.length ? ` • ${d.mediaUrls.length} ảnh` : ""}
                  </div>
                </div>
                <StatusPill status={d.status} />
              </div>

              <div className="seller-disputes__message seller-disputes__clamp">{d.message}</div>

              <div className="seller-disputes__actions">
                <button className="btn-primary" type="button" onClick={() => openDetail(d)}>
                  Xem & phản hồi
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="card seller-disputes__empty">Chưa có khiếu nại nào.</div>
        )}
      </div>

      <DisputesModal open={open} title="Chi tiết khiếu nại" onClose={() => setOpen(false)}>
        {selected ? (
          <div className="seller-disputes__detail">
            <div className="seller-disputes__detailMeta">
              <div>
                <span className="muted">Đơn:</span> <b>{selected.order?.code}</b>
              </div>
              <div>
                <span className="muted">Khách:</span> {selected.user?.username || selected.user?.email || "-"}
              </div>
              <div>
                <span className="muted">Trạng thái đơn:</span> {formatOrderStatus(selected.order?.status)}
              </div>
              <div>
                <span className="muted">Trạng thái khiếu nại:</span> <StatusPill status={selected.status} />
              </div>
            </div>

            <div className="seller-disputes__box">
              <div className="seller-disputes__boxTitle">Nội dung khách gửi</div>
              <div className="seller-disputes__boxMeta muted">{formatDateTime(selected.createdAt)}</div>
              <div className="seller-disputes__boxBody">{selected.message}</div>
            </div>

            {Array.isArray(selected.mediaUrls) && selected.mediaUrls.length ? (
              <div className="seller-disputes__box">
                <div className="seller-disputes__boxTitle">Ảnh đính kèm</div>
                <div className="seller-disputes__gallery" aria-label="Ảnh bằng chứng">
                  {selected.mediaUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="seller-disputes__galleryItem">
                      <img className="seller-disputes__galleryImg" src={url} alt={`evidence-${idx + 1}`} />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {selected.revisionRequestedAt ? (
              <div className="seller-disputes__revision">
                <div className="seller-disputes__boxTitle">Yêu cầu xem lại</div>
                <div className="seller-disputes__boxMeta muted">{formatDateTime(selected.revisionRequestedAt)}</div>
                {selected.revisionRequestNote ? <div className="seller-disputes__boxBody">{selected.revisionRequestNote}</div> : null}
              </div>
            ) : null}

            {selected.resolution ? (
              <div className="seller-disputes__resolution">
                <div className="seller-disputes__boxTitle">Phản hồi/Quyết định từ Admin</div>
                <div className="seller-disputes__boxBody">{selected.resolution}</div>
              </div>
            ) : null}

            {canRequestRevision(selected) ? (
              <div className="seller-disputes__revisionForm">
                <div className="seller-disputes__boxTitle">Gửi yêu cầu xem lại (1 lần)</div>
                <textarea
                  className="textarea seller-disputes__textarea"
                  rows={4}
                  value={revNote}
                  onChange={(e) => setRevNote(e.target.value)}
                  placeholder="Mô tả ngắn lý do muốn admin xem lại (tuỳ chọn)..."
                />
                <div className="seller-disputes__revisionActions">
                  <button className="btn-secondary" type="button" onClick={requestRevision} disabled={revSending}>
                    {revSending ? "Đang gửi..." : "Gửi yêu cầu"}
                  </button>
                </div>
                <div className="seller-disputes__hint muted">Chỉ được yêu cầu 1 lần và admin chỉ được sửa 1 lần khi có yêu cầu.</div>
              </div>
            ) : null}

            <div className="seller-disputes__field">
              <div className="seller-disputes__boxTitle">Phản hồi của shop</div>
              <textarea
                className="textarea seller-disputes__textarea"
                rows={5}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Nhập phản hồi cho khách hàng..."
                disabled={selected.status === "RESOLVED" || selected.status === "REJECTED"}
              />
              <div className="seller-disputes__hint muted">Nếu admin đã xử lý hoặc từ chối, shop không thể cập nhật thêm.</div>
            </div>

            <div className="seller-disputes__detailActions">
              <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
                Đóng
              </button>
              <button
                className="btn-primary"
                onClick={sendReply}
                disabled={sending || selected.status === "RESOLVED" || selected.status === "REJECTED"}
                type="button"
              >
                {sending ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </div>
        ) : null}
      </DisputesModal>
    </section>
  );
}
