import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";
import Skeleton from "../../components/ui/Skeleton";
import { formatDateTime, formatOrderStatus, formatVnd } from "../../utils/format";

import "./AdminDisputes.css";

function StatusPill({ status }) {
  const map = {
    OPEN: { label: "Mới", cls: "badge badge--warning" },
    UNDER_REVIEW: { label: "Đang xem xét", cls: "badge badge--warning" },
    RESOLVED: { label: "Đã xử lý", cls: "badge badge--success" },
    REJECTED: { label: "Từ chối", cls: "badge badge--danger" },
  };
  const v = map[status] || { label: status || "-", cls: "badge" };
  return <span className={v.cls}>{v.label}</span>;
}

function NeedsRevisionBadge({ dispute }) {
  if (!dispute?.revisionRequestedAt) return null;
  return <span className="badge badge--warning">Yêu cầu xem lại</span>;
}

function DisputeModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal admin-disputes__modal" onMouseDown={(e) => e.stopPropagation()}>
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

function isFinalStatus(status) {
  return status === "RESOLVED" || status === "REJECTED";
}

function canEditDecision(dispute) {
  if (!dispute) return false;
  if (!isFinalStatus(dispute.status)) return true;
  const editCount = Number(dispute.editCount || 0);
  return !!dispute.revisionRequestedAt && editCount < 1;
}

export default function AdminDisputes() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // View: PENDING (OPEN/UNDER_REVIEW) | PROCESSED (RESOLVED/REJECTED)
  const [view, setView] = useState("PENDING");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [decision, setDecision] = useState("APPROVE");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminApi.listDisputes();
      if (res?.success) setList(res.data || []);
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

  const { pending, processed } = useMemo(() => {
    const p = [];
    const done = [];
    (list || []).forEach((d) => {
      if (d.status === "RESOLVED" || d.status === "REJECTED") done.push(d);
      else p.push(d);
    });
    return { pending: p, processed: done };
  }, [list]);

  const visible = useMemo(() => (view === "PROCESSED" ? processed : pending), [view, pending, processed]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return visible;
    return (visible || []).filter((d) => {
      const code = String(d.order?.code || "").toLowerCase();
      const shop = String(d.order?.shop?.name || "").toLowerCase();
      const user = String(d.user?.username || d.user?.email || "").toLowerCase();
      return code.includes(q) || shop.includes(q) || user.includes(q);
    });
  }, [visible, search]);

  const stats = useMemo(() => {
    const s = {
      total: list.length,
      pending: 0,
      processed: 0,
      needsRevision: 0,
    };
    (list || []).forEach((d) => {
      if (d.status === "RESOLVED" || d.status === "REJECTED") s.processed += 1;
      else s.pending += 1;
      if (d.revisionRequestedAt) s.needsRevision += 1;
    });
    return s;
  }, [list]);

  function openDetail(d) {
    setSelected(d);
    setDecision(d.status === "REJECTED" ? "REJECT" : "APPROVE");
    setResolution(d.resolution || "");
    setOpen(true);
  }

  async function save() {
    if (!selected) return;

    if (!canEditDecision(selected)) {
      return;
    }

    const note = (resolution || "").trim();
    if (!note || note.length < 5) {
      alert("Vui lòng nhập ghi chú xử lý (tối thiểu 5 ký tự)");
      return;
    }

    setSaving(true);
    try {
      const res = await adminApi.resolveDispute(selected.id, {
        decision,
        resolution: note,
      });
      if (res?.success) {
        await load();
        setOpen(false);
        setSelected(null);
      } else {
        alert(res?.message || "Lưu thất bại");
      }
    } catch (e) {
      alert(e?.data?.message || e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  const showDecisionForm = useMemo(() => canEditDecision(selected), [selected]);

  return (
    <section className="admin-disputes">
      <div className="admin-disputes__header">
        <div>
          <div className="admin-disputes__title">Khiếu nại / Tranh chấp</div>
          <div className="muted admin-disputes__subtitle">
            Admin duyệt hoặc từ chối khiếu nại. Khiếu nại đã xử lý sẽ chuyển sang mục <b>Đã xử lý</b>.
          </div>
        </div>
        <div className="admin-disputes__filters">
          <select className="input admin-disputes__select" value={view} onChange={(e) => setView(e.target.value)}>
            <option value="PENDING">Chờ xử lý</option>
            <option value="PROCESSED">Đã xử lý</option>
          </select>
          <input
            className="input"
            placeholder="Tìm theo mã đơn / shop / user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <button className="btn-secondary" onClick={load} disabled={loading} type="button">
            Tải lại
          </button>
        </div>
      </div>

      <div className="admin-disputes__kpis">
        <div className="admin-disputes__kpi card">
          <div className="muted admin-disputes__kpiLabel">Tổng</div>
          <div className="admin-disputes__kpiValue">{stats.total}</div>
        </div>
        <div className="admin-disputes__kpi card">
          <div className="muted admin-disputes__kpiLabel">Chờ xử lý</div>
          <div className="admin-disputes__kpiValue">{stats.pending}</div>
        </div>
        <div className="admin-disputes__kpi card">
          <div className="muted admin-disputes__kpiLabel">Đã xử lý</div>
          <div className="admin-disputes__kpiValue">{stats.processed}</div>
        </div>
        <div className="admin-disputes__kpi card">
          <div className="muted admin-disputes__kpiLabel">Yêu cầu xem lại</div>
          <div className="admin-disputes__kpiValue">{stats.needsRevision}</div>
        </div>
      </div>

      {err ? <div className="alert alert--error admin-disputes__alert">{err}</div> : null}

      <div className="admin-disputes__list">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card admin-disputes__skeletonCard">
              <Skeleton style={{ width: 240, height: 14 }} />
              <div style={{ height: 10 }} />
              <Skeleton style={{ width: "80%", height: 12 }} />
              <div style={{ height: 10 }} />
              <Skeleton style={{ width: 160, height: 12 }} />
            </div>
          ))
        ) : filtered?.length ? (
          filtered.map((d) => (
            <div key={d.id} className="card admin-disputes__item">
              <div className="admin-disputes__itemHead">
                <div className="admin-disputes__itemMeta">
                  <div className="admin-disputes__orderTitle">
                    Đơn {d.order?.code} • {d.order?.shop?.name}
                  </div>
                  <div className="muted admin-disputes__orderSub">
                    {formatDateTime(d.createdAt)} • User: {d.user?.username || d.user?.email}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <NeedsRevisionBadge dispute={d} />
                  <StatusPill status={d.status} />
                </div>
              </div>

              <div className="admin-disputes__message admin-disputes__clamp">{d.message}</div>

              {Array.isArray(d.mediaUrls) && d.mediaUrls.length ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  Có {d.mediaUrls.length} ảnh đính kèm
                </div>
              ) : null}

              <div className="admin-disputes__itemFoot">
                <div className="muted admin-disputes__orderInfo">
                  {formatOrderStatus(d.order?.status)} • {formatVnd(d.order?.total || 0)}
                </div>
                <button className="btn-primary" onClick={() => openDetail(d)} type="button">
                  {view === "PROCESSED" ? "Xem" : "Xử lý"}
                </button>
              </div>

              {d.resolution ? (
                <div className="admin-disputes__resolution">
                  <div className="admin-disputes__resolutionTitle">Kết quả xử lý</div>
                  <div className="admin-disputes__resolutionText">{d.resolution}</div>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="card admin-disputes__empty">Chưa có khiếu nại nào.</div>
        )}
      </div>

      <DisputeModal open={open} title={view === "PROCESSED" ? "Chi tiết khiếu nại" : "Xử lý khiếu nại"} onClose={() => setOpen(false)}>
        {selected ? (
          <div className="admin-disputes__modalContent">
            <div className="admin-disputes__summary">
              <div>
                <span className="muted">Đơn:</span> <b>{selected.order?.code}</b>
              </div>
              <div>
                <span className="muted">Shop:</span> {selected.order?.shop?.name}
              </div>
              <div>
                <span className="muted">User:</span> {selected.user?.username || selected.user?.email}
              </div>
              <div>
                <span className="muted">Trạng thái đơn:</span> {formatOrderStatus(selected.order?.status)}
              </div>
              <div>
                <span className="muted">Trạng thái khiếu nại:</span> <StatusPill status={selected.status} />
                {selected.revisionRequestedAt ? (
                  <span style={{ marginLeft: 8 }}>
                    <NeedsRevisionBadge dispute={selected} />
                  </span>
                ) : null}
                {Number(selected.editCount || 0) > 0 ? <span className="badge">Đã sửa {selected.editCount} lần</span> : null}
              </div>
            </div>

            <div className="admin-disputes__box">
              <div className="admin-disputes__boxTitle">Nội dung khách gửi</div>
              <div className="muted admin-disputes__boxMeta">{formatDateTime(selected.createdAt)}</div>
              <div className="admin-disputes__boxText">{selected.message}</div>

              {Array.isArray(selected.mediaUrls) && selected.mediaUrls.length ? (
                <div className="admin-disputes__gallery" aria-label="Ảnh bằng chứng">
                  {selected.mediaUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="admin-disputes__galleryItem">
                      <img className="admin-disputes__galleryImg" src={url} alt={`evidence-${idx + 1}`} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {selected.sellerResponse ? (
              <div className="admin-disputes__box admin-disputes__box--reply">
                <div className="admin-disputes__boxTitle">Phản hồi của shop</div>
                {selected.sellerRespondedAt ? (
                  <div className="muted admin-disputes__boxMeta">{formatDateTime(selected.sellerRespondedAt)}</div>
                ) : null}
                <div className="admin-disputes__boxText">{selected.sellerResponse}</div>
              </div>
            ) : null}

            {selected.revisionRequestedAt ? (
              <div className="admin-disputes__revision">
                <div className="admin-disputes__boxTitle">Yêu cầu xem lại</div>
                <div className="muted admin-disputes__boxMeta">{formatDateTime(selected.revisionRequestedAt)}</div>
                {selected.revisionRequestNote ? <div className="admin-disputes__boxText">{selected.revisionRequestNote}</div> : null}
              </div>
            ) : null}

            {!showDecisionForm && selected.resolution ? (
              <div className="admin-disputes__resolution">
                <div className="admin-disputes__resolutionTitle">Kết quả xử lý</div>
                <div className="admin-disputes__resolutionText">{selected.resolution}</div>
              </div>
            ) : null}

            {showDecisionForm ? (
              <>
                <div className="admin-disputes__field">
                  <div className="admin-disputes__fieldLabel">Quyết định</div>
                  <select className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="APPROVE">Duyệt (chấp nhận khiếu nại)</option>
                    <option value="REJECT">Từ chối khiếu nại</option>
                  </select>
                  <div className="admin-disputes__hint">
                    Chỉ duyệt hoặc từ chối. Nếu đã xử lý, chỉ được sửa đúng 1 lần khi có yêu cầu xem lại.
                  </div>
                </div>

                <div className="admin-disputes__field">
                  <div className="admin-disputes__fieldLabel">Ghi chú xử lý</div>
                  <textarea
                    className="textarea admin-disputes__textarea"
                    rows={5}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Nội dung phản hồi / hướng xử lý..."
                  />
                  <div className="admin-disputes__hint">Tối thiểu 5 ký tự.</div>
                </div>

                <div className="admin-disputes__modalActions">
                  <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
                    Huỷ
                  </button>
                  <button className="btn-primary" onClick={save} disabled={saving} type="button">
                    {saving ? "Đang lưu..." : "Lưu"}
                  </button>
                </div>
              </>
            ) : (
              <div className="admin-disputes__modalActions">
                <button className="btn-secondary" onClick={() => setOpen(false)} type="button">
                  Đóng
                </button>
              </div>
            )}
          </div>
        ) : null}
      </DisputeModal>
    </section>
  );
}
