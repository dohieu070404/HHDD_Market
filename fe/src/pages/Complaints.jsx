import { useEffect, useMemo, useRef, useState } from "react";
import "./Complaints.css";
import { Link, useSearchParams } from "react-router-dom";
import { customerApi } from "../api/customer";
import { formatDateTime, formatOrderStatus, formatVnd } from "../utils/format";

function DisputeStatusBadge({ status }) {
  const map = {
    OPEN: { label: "Mới tạo", cls: "badge badge--warning" },
    UNDER_REVIEW: { label: "Đang xem xét", cls: "badge badge--warning" },
    RESOLVED: { label: "Đã xử lý", cls: "badge badge--success" },
    REJECTED: { label: "Từ chối", cls: "badge badge--danger" },
  };
  const v = map[status] || { label: status || "-", cls: "badge" };
  return <span className={v.cls}>{v.label}</span>;
}

function SkeletonCard() {
  return (
    <div className="card complaints-skeletonCard">
      <div className="complaints-skeletonCard__head">
        <div className="skeleton complaints-skeletonCard__title" />
        <div className="skeleton complaints-skeletonCard__pill" />
      </div>
      <div className="complaints-skeletonCard__lines">
        <div className="skeleton complaints-skeletonCard__line complaints-skeletonCard__line--lg" />
        <div className="skeleton complaints-skeletonCard__line complaints-skeletonCard__line--md" />
      </div>
    </div>
  );
}

function canRequestRevision(dispute) {
  const isFinal = dispute?.status === "RESOLVED" || dispute?.status === "REJECTED";
  const editCount = Number(dispute?.editCount || 0);
  return isFinal && editCount < 1 && !dispute?.revisionRequestedAt;
}

export default function Complaints() {
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("order") || "";

  const [tab, setTab] = useState(preselect ? "NEW" : "LIST"); // LIST | NEW
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);

  const [form, setForm] = useState({ orderCode: preselect, type: "Hỗ trợ đơn hàng", message: "" });

  // Evidence images (local preview)
  const [evidence, setEvidence] = useState([]); // [{ file, previewUrl }]
  const previewUrlsRef = useRef(new Set());

  useEffect(() => {
    return () => {
      try {
        previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      } catch {
        // ignore
      }
      previewUrlsRef.current.clear();
    };
  }, []);

  const eligibleOrders = useMemo(() => {
    // Chỉ cho phép khiếu nại khi đơn đã giao/hoàn tất hoặc đang trong luồng trả/hoàn
    const allowed = new Set([
      "DELIVERED",
      "COMPLETED",
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_REJECTED",
      "RETURN_RECEIVED",
      "REFUND_REQUESTED",
      "REFUNDED",
    ]);
    return (orders || []).filter((o) => allowed.has(o.status));
  }, [orders]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [oRes, dRes] = await Promise.all([customerApi.listOrders({ limit: 50 }), customerApi.listDisputes()]);
      if (oRes?.success) setOrders(oRes.data?.items || []);
      if (dRes?.success) setDisputes(dRes.data || []);

      if (preselect) {
        setTab("NEW");
        setForm((s) => ({ ...s, orderCode: preselect }));
      }
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addEvidenceFiles(fileList) {
    setErr(null);

    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    const max = 6;
    const remain = Math.max(0, max - evidence.length);
    if (remain <= 0) {
      setErr("Bạn chỉ có thể đính kèm tối đa 6 ảnh.");
      return;
    }

    const picked = files.slice(0, remain).filter((f) => (f.type || "").startsWith("image/"));
    const tooLarge = picked.find((f) => f.size > 4 * 1024 * 1024);
    if (tooLarge) {
      setErr("Ảnh quá lớn. Mỗi ảnh tối đa 4MB.");
      return;
    }

    const next = picked.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return { file, previewUrl };
    });

    setEvidence((prev) => [...prev, ...next]);
  }

  function removeEvidence(index) {
    setEvidence((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item?.previewUrl) {
        try {
          URL.revokeObjectURL(item.previewUrl);
        } catch {
          // ignore
        }
        previewUrlsRef.current.delete(item.previewUrl);
      }
      next.splice(index, 1);
      return next;
    });
  }

  async function submit() {
    setErr(null);
    setOk(null);

    if (!form.orderCode) {
      setErr("Vui lòng chọn đơn hàng.");
      return;
    }
    if (!form.message || form.message.trim().length < 10) {
      setErr("Vui lòng nhập nội dung (tối thiểu 10 ký tự).");
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrls = [];
      if (evidence.length) {
        const up = await customerApi.uploadDisputeImages(evidence.map((x) => x.file));
        if (!up?.success) throw new Error(up?.message || "Tải ảnh lên thất bại");
        mediaUrls = up.data?.urls || [];
      }

      const res = await customerApi.createDispute(form.orderCode, {
        type: form.type,
        message: form.message.trim(),
        mediaUrls,
      });

      if (res?.success) {
        setForm((s) => ({ ...s, message: "" }));
        setEvidence([]);
        setOk(res?.message || "Đã gửi khiếu nại");
        await load();
        setTab("LIST");
      } else {
        setErr(res?.message || "Gửi khiếu nại thất bại");
      }
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Gửi khiếu nại thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const [revForId, setRevForId] = useState(null);
  const [revNote, setRevNote] = useState("");

  async function submitRevision(disputeId) {
    setErr(null);
    setOk(null);
    setRevSubmitting(true);
    try {
      const payload = revNote?.trim() ? { note: revNote.trim() } : {};
      const res = await customerApi.requestDisputeRevision(disputeId, payload);
      if (res?.success) {
        setOk(res?.message || "Đã gửi yêu cầu xem lại");
        setRevForId(null);
        setRevNote("");
        await load();
      } else {
        setErr(res?.message || "Gửi yêu cầu xem lại thất bại");
      }
    } catch (e) {
      setErr(e?.data?.message || e?.message || "Gửi yêu cầu xem lại thất bại");
    } finally {
      setRevSubmitting(false);
    }
  }

  return (
    <div className="complaints-page">
      <div className="container-page complaints-page__container">
        <div className="complaints-page__header">
          <div className="complaints-page__headText">
            <h1 className="complaints-page__title">Trung tâm Khiếu nại</h1>
            <p className="complaints-page__subtitle muted">
              Theo dõi toàn bộ khiếu nại tập trung, bao gồm phản hồi từ shop và kết quả xử lý.
            </p>
          </div>

          <div className="complaints-page__tabs">
            <button
              className={"btn-secondary " + (tab === "LIST" ? "btn-secondary--active" : "")}
              onClick={() => setTab("LIST")}
            >
              Danh sách
            </button>
            <button
              className={"btn-primary " + (tab === "NEW" ? "btn-primary--active" : "")}
              onClick={() => setTab("NEW")}
            >
              Tạo khiếu nại
            </button>
          </div>
        </div>

        {err ? <div className="alert alert--error complaints-page__alert">{err}</div> : null}
        {ok ? <div className="alert alert--success complaints-page__alert">{ok}</div> : null}

        {tab === "NEW" ? (
          <div className="complaints-new">
            <div className="card complaints-new__main">
              <div className="section-title">Tạo khiếu nại</div>

              <div className="complaints-new__grid">
                <div className="complaints-new__field">
                  <div className="complaints-new__label">Chọn đơn hàng</div>
                  <select
                    className="input"
                    value={form.orderCode}
                    onChange={(e) => setForm((s) => ({ ...s, orderCode: e.target.value }))}
                  >
                    <option value="">-- Chọn đơn --</option>
                    {(eligibleOrders || []).map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.code} • {formatOrderStatus(o.status)} • {formatVnd(o.total)}
                      </option>
                    ))}
                  </select>
                  <div className="complaints-new__hint muted">
                    Chỉ hiển thị các đơn đủ điều kiện (đã giao/hoàn tất hoặc đang trả/hoàn).
                  </div>
                </div>

                <div className="complaints-new__field">
                  <div className="complaints-new__label">Loại yêu cầu</div>
                  <input
                    className="input"
                    value={form.type}
                    onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                    placeholder="Ví dụ: Giao sai hàng, sản phẩm lỗi..."
                  />
                </div>

                <div className="complaints-new__field">
                  <div className="complaints-new__label">Nội dung</div>
                  <textarea
                    className="textarea"
                    rows={6}
                    value={form.message}
                    onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
                    placeholder="Mô tả chi tiết vấn đề, thời gian, thông tin liên quan..."
                  />
                </div>

                <div className="complaints-new__field">
                  <div className="complaints-new__label">Ảnh đính kèm (tối đa 6)</div>
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      addEvidenceFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {evidence.length ? (
                    <div className="complaints-evidence__grid" aria-label="Ảnh đính kèm">
                      {evidence.map((ev, idx) => (
                        <div key={idx} className="complaints-evidence__item">
                          <img className="complaints-evidence__img" src={ev.previewUrl} alt={`evidence-${idx + 1}`} />
                          <button
                            type="button"
                            className="complaints-evidence__remove"
                            onClick={() => removeEvidence(idx)}
                            aria-label="Xoá ảnh"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="complaints-new__hint muted">Ảnh giúp shop/admin xử lý nhanh hơn (mỗi ảnh tối đa 4MB).</div>
                </div>

                <div className="complaints-new__actions">
                  <Link to="/orders" className="btn-secondary">
                    Xem đơn hàng
                  </Link>
                  <button className="btn-primary" disabled={submitting} onClick={submit}>
                    {submitting ? "Đang gửi..." : "Gửi khiếu nại"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card complaints-new__aside">
              <div className="section-title">Lưu ý</div>
              <ul className="complaints-new__asideList muted">
                <li>Đính kèm ảnh giúp xử lý nhanh và rõ ràng hơn.</li>
                <li>Nếu đã có khiếu nại cho đơn này, hệ thống sẽ không cho tạo thêm.</li>
                <li>Bạn có thể gửi "Yêu cầu xem lại" 1 lần sau khi admin đã xử lý (nếu cần).</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="complaints-list">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : disputes?.length ? (
              disputes.map((d) => (
                <div key={d.id} className="card complaint-card">
                  <div className="complaint-card__head">
                    <div className="complaint-card__meta">
                      <div className="complaint-card__titleRow">
                        <div className="complaint-card__title">Đơn {d.order?.code}</div>
                        {d.order?.shop ? (
                          <Link to={`/shop/${d.order.shop.slug}`} className="complaint-card__shopLink">
                            • {d.order.shop.name}
                          </Link>
                        ) : null}
                      </div>
                      <div className="complaint-card__time muted">Tạo lúc {formatDateTime(d.createdAt)}</div>
                    </div>
                    <div className="complaint-card__badges">
                      <DisputeStatusBadge status={d.status} />
                      {d.revisionRequestedAt ? <span className="badge badge--warning">Đang chờ xem lại</span> : null}
                      {Number(d.editCount || 0) >= 1 ? <span className="badge">Đã sửa 1 lần</span> : null}
                    </div>
                  </div>

                  <div className="complaint-card__body">
                    <div className="complaint-card__type muted">Loại: {d.type || "-"}</div>
                    <div className="complaint-card__message">{d.message}</div>

                    {Array.isArray(d.mediaUrls) && d.mediaUrls.length ? (
                      <div className="complaint-card__gallery" aria-label="Ảnh đính kèm">
                        {d.mediaUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="complaint-card__galleryItem"
                          >
                            <img className="complaint-card__galleryImg" src={url} alt={`dispute-${d.id}-img-${idx + 1}`} />
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {d.revisionRequestedAt ? (
                      <div className="complaint-revision">
                        <div className="complaint-box__title">Yêu cầu xem lại</div>
                        <div className="complaint-box__time muted">{formatDateTime(d.revisionRequestedAt)}</div>
                        {d.revisionRequestNote ? <div className="complaint-box__content">{d.revisionRequestNote}</div> : null}
                      </div>
                    ) : null}
                  </div>

                  {d.sellerResponse ? (
                    <div className="complaint-reply">
                      <div className="complaint-box__title">Phản hồi từ shop</div>
                      {d.sellerRespondedAt ? <div className="complaint-box__time muted">{formatDateTime(d.sellerRespondedAt)}</div> : null}
                      <div className="complaint-box__content">{d.sellerResponse}</div>
                    </div>
                  ) : null}

                  {d.resolution ? (
                    <div className="complaint-resolution">
                      <div className="complaint-box__title">Kết quả xử lý</div>
                      <div className="complaint-box__content">{d.resolution}</div>
                    </div>
                  ) : null}

                  {revForId === d.id ? (
                    <div className="complaint-revisionForm">
                      <div className="complaint-box__title">Gửi yêu cầu xem lại</div>
                      <textarea
                        className="textarea"
                        rows={4}
                        value={revNote}
                        onChange={(e) => setRevNote(e.target.value)}
                        placeholder="Mô tả ngắn lý do muốn xem lại (tuỳ chọn)..."
                      />
                      <div className="complaint-revisionForm__actions">
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setRevForId(null);
                            setRevNote("");
                          }}
                          disabled={revSubmitting}
                        >
                          Huỷ
                        </button>
                        <button
                          className="btn-primary"
                          onClick={() => submitRevision(d.id)}
                          disabled={revSubmitting}
                        >
                          {revSubmitting ? "Đang gửi..." : "Gửi"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="complaint-card__footer">
                    <div className="complaint-card__orderStatus muted">Trạng thái đơn: {formatOrderStatus(d.order?.status)}</div>

                    <div className="complaint-card__footerActions">
                      {canRequestRevision(d) ? (
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setRevForId(d.id);
                            setRevNote("");
                          }}
                        >
                          Yêu cầu xem lại
                        </button>
                      ) : null}

                      <Link className="btn-secondary" to={`/orders/o/${encodeURIComponent(d.order?.code || "")}`}>
                        Xem chi tiết đơn
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="card complaints-empty">
                <div className="complaints-empty__title">Bạn chưa tạo khiếu nại nào.</div>
                <button className="btn-primary complaints-empty__btn" onClick={() => setTab("NEW")}>
                  Tạo khiếu nại
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
