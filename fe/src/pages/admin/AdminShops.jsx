import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";
import Skeleton from "../../components/ui/Skeleton";
import { formatDate } from "../../utils/format";

import "./AdminShops.css";

const STATUS_LABEL = {
  PENDING: "Chờ duyệt",
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm khoá",
  HIDDEN: "Ẩn",
  BANNED: "Khoá vĩnh viễn",
  REJECTED: "Từ chối",
};

const MOD_ACTIONS = [
  // { value: "WARN_1", label: "Cảnh cáo lần 1" },
  // { value: "WARN_2", label: "Cảnh cáo lần 2" },
  // { value: "WARN_3", label: "Cảnh cáo lần 3" },
  { value: "SUSPEND_7D", label: "Tạm khoá 7 ngày" },
  { value: "SUSPEND_30D", label: "Tạm khoá 30 ngày" },
  { value: "HIDE", label: "Ẩn shop" },
  { value: "UNHIDE", label: "Hiện shop" },
  { value: "BAN", label: "Ban vĩnh viễn" },
  { value: "UNBAN", label: "Gỡ ban" },

  // NOTE: Tính năng điều chỉnh điểm vi phạm không còn dùng (đã bỏ khỏi option).
  // { value: "ADJUST_POINTS", label: "Điều chỉnh điểm vi phạm" },
];

function Badge({ status }) {
  let variant = "badge--gray";
  if (status === "ACTIVE") variant = "badge--success";
  if (status === "PENDING") variant = "badge--warning";
  if (status === "SUSPENDED") variant = "badge--danger";
  if (status === "BANNED") variant = "badge--danger";
  if (status === "HIDDEN") variant = "badge--gray";
  return <span className={`badge ${variant}`}>{STATUS_LABEL[status] || status}</span>;
}

function ShopAvatar({ shop }) {
  const name = shop?.name || "";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  if (shop?.logoUrl) {
    return <img className="admin-shops__avatar" src={shop.logoUrl} alt={shop.name} />;
  }
  return <div className="admin-shops__avatar admin-shops__avatar--placeholder">{initials || "S"}</div>;
}

function ActionModal({
  open,
  shop,
  action,
  setAction,
  note,
  setNote,

  // NOTE: Không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
  // pointsDelta,
  // setPointsDelta,

  submitting,
  onClose,
  onSubmit,
}) {
  if (!open || !shop) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal admin-shops__modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div className="modal__title">Cảnh cáo / Khoá / Ban shop</div>
          <button className="btn-secondary" onClick={onClose} disabled={submitting} type="button">
            Đóng
          </button>
        </div>

        <div className="modal__body">
          <div className="admin-shops__modalShopName">{shop.name}</div>
          <div className="admin-shops__modalShopSlug muted">/{shop.slug}</div>

          <div className="admin-shops__modalForm">
            <div className="admin-shops__field">
              <div className="label">Hành động</div>
              <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">-- Chọn hành động --</option>
                {MOD_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/*
              NOTE: UI điều chỉnh điểm không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
              Nếu bật lại ADJUST_POINTS trong MOD_ACTIONS thì mở comment phần này + state/props tương ứng.
            {action === "ADJUST_POINTS" ? (
              <div className="admin-shops__field">
                <div className="label">Điểm cộng/trừ</div>
                <input
                  className="input"
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(e.target.value)}
                  placeholder="Ví dụ: 5 hoặc -3"
                />
              </div>
            ) : null}
            */}

            <div className="admin-shops__field">
              <div className="label">Ghi chú</div>
              <textarea
                className="textarea admin-shops__textarea"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mô tả lý do xử lý (khuyến nghị nhập)..."
              />
            </div>

            <div className="admin-shops__modalActions">
              <button className="btn-secondary" onClick={onClose} disabled={submitting} type="button">
                Huỷ
              </button>
              <button className="btn-primary" onClick={onSubmit} disabled={submitting || !action} type="button">
                {submitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminShops() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shops, setShops] = useState([]);

  const [actionShop, setActionShop] = useState(null);
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");

  // NOTE: Không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
  // const [pointsDelta, setPointsDelta] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await adminApi.listShops({ q: q.trim() || undefined, status: status || undefined });
      if (res?.success) {
        setShops(res.data || []);
        setError(null);
      } else {
        setError(res?.message || "Không tải được danh sách shop");
      }
    } catch (e) {
      setError(e?.data?.message || e?.message || "Không tải được danh sách shop");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = shops.length;
    const active = shops.filter((s) => s.status === "ACTIVE").length;
    const pending = shops.filter((s) => s.status === "PENDING").length;
    const suspended = shops.filter((s) => s.status === "SUSPENDED").length;
    const banned = shops.filter((s) => s.status === "BANNED").length;
    const hidden = shops.filter((s) => s.status === "HIDDEN").length;
    return { total, active, pending, suspended, banned, hidden };
  }, [shops]);

  function openActionModal(shop) {
    setActionShop(shop);
    setAction("");
    setNote("");

    // NOTE: Không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
    // setPointsDelta(0);
  }

  function closeActionModal() {
    if (submitting) return;
    setActionShop(null);
    setAction("");
    setNote("");

    // NOTE: Không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
    // setPointsDelta(0);
  }

  async function submitAction() {
    if (!actionShop || !action) return;
    try {
      setSubmitting(true);
      const payload = { action, note: note?.trim() || undefined };

      // NOTE: Logic điều chỉnh điểm không dùng nữa vì ADJUST_POINTS đã bỏ khỏi option.
      // if (action === "ADJUST_POINTS") payload.pointsDelta = Number(pointsDelta || 0);

      const res = await adminApi.moderateShop(actionShop.id, payload);
      if (!res?.success) {
        throw new Error(res?.message || "Không thể cập nhật chế tài");
      }
      closeActionModal();
      await load();
    } catch (e) {
      window.alert(e?.data?.message || e?.message || "Không thể cập nhật chế tài");
    } finally {
      setSubmitting(false);
    }
  }

  async function approvePending(shop) {
    if (!shop) return;
    if (!window.confirm(`Duyệt hồ sơ mở shop "${shop.name}"?`)) return;
    try {
      setSubmitting(true);
      // Approve seller profile + activate shop in 1 transaction (backend).
      const res = await adminApi.approveSeller(shop.ownerId);
      if (!res?.success) throw new Error(res?.message || "Không duyệt được.");
      await load();
    } catch (e) {
      window.alert(e?.data?.message || e?.message || "Không duyệt được.");
    } finally {
      setSubmitting(false);
    }
  }

  async function rejectPending(shop) {
    if (!shop) return;
    const reason = window.prompt("Lý do từ chối (bắt buộc):", "Thông tin chưa hợp lệ");
    if (!reason) return;
    try {
      setSubmitting(true);
      const res = await adminApi.rejectSeller(shop.ownerId, reason);
      if (!res?.success) throw new Error(res?.message || "Không từ chối được.");
      await load();
    } catch (e) {
      window.alert(e?.data?.message || e?.message || "Không từ chối được.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="admin-shops">
      <div className="card admin-shops__panel">
        <div className="admin-shops__panelHead">
          <div>
            <div className="admin-shops__title">Quản trị Shop</div>
            <div className="admin-shops__subtitle muted">
              Cảnh cáo / tạm khoá / ban vĩnh viễn theo báo cáo hợp lệ & điểm vi phạm (chống report phá shop).
            </div>
          </div>

          <div className="admin-shops__filters">
            <input
              className="input admin-shops__search"
              placeholder="Tìm theo tên/slug"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="select admin-shops__statusSelect" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="SUSPENDED">Tạm khoá</option>
              <option value="HIDDEN">Ẩn</option>
              <option value="BANNED">Ban vĩnh viễn</option>
              <option value="REJECTED">Từ chối</option>
            </select>
            <button className="btn-primary btn-sm" onClick={load} disabled={loading} type="button">
              Lọc
            </button>
          </div>
        </div>

        <div className="admin-shops__kpis">
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Tổng shop</div>
            <div className="admin-shops__kpiValue">{stats.total}</div>
          </div>
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Hoạt động</div>
            <div className="admin-shops__kpiValue">{stats.active}</div>
          </div>
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Chờ duyệt</div>
            <div className="admin-shops__kpiValue">{stats.pending}</div>
          </div>
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Tạm khoá</div>
            <div className="admin-shops__kpiValue">{stats.suspended}</div>
          </div>
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Ban</div>
            <div className="admin-shops__kpiValue">{stats.banned}</div>
          </div>
          <div className="admin-shops__kpi">
            <div className="admin-shops__kpiLabel">Ẩn</div>
            <div className="admin-shops__kpiValue">{stats.hidden}</div>
          </div>
        </div>
      </div>

      <div className="card admin-shops__tableCard">
        {loading ? (
          <div className="admin-shops__skeleton">
            <Skeleton style={{ height: 32, width: "100%" }} />
            <Skeleton style={{ height: 32, width: "100%" }} />
            <Skeleton style={{ height: 32, width: "100%" }} />
          </div>
        ) : error ? (
          <div className="alert alert--danger admin-shops__alert">{error}</div>
        ) : (
          <div className="admin-shops__tableWrap">
            <table className="table table--tiki admin-shops__table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Owner</th>
                  <th>Trạng thái</th>
                  <th>Báo cáo (OPEN)</th>

                  {/* NOTE: Bỏ cột Điểm khỏi bảng (tạm thời không hiển thị) */}
                  {/* <th>Điểm</th> */}

                  <th>Strike</th>

                  {/* NOTE: Bỏ cột Tỉ lệ hợp lệ (60d) khỏi bảng (tạm thời không hiển thị) */}
                  {/* <th>Tỉ lệ hợp lệ (60d)</th> */}

                  <th>Ngày tạo</th>
                  <th className="admin-shops__thRight">Hành động</th>
                </tr>
              </thead>

              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="admin-shops__shopCell">
                        <ShopAvatar shop={s} />
                        <div>
                          <div className="admin-shops__shopName">{s.name}</div>
                          <div className="admin-shops__shopSlug muted">/{s.slug}</div>
                          {s.moderationNote ? <div className="admin-shops__moderationNote muted">{s.moderationNote}</div> : null}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="admin-shops__ownerEmail">{s.owner?.email}</div>
                      <div className="admin-shops__ownerUser muted">@{s.owner?.username}</div>
                    </td>

                    <td>
                      <Badge status={s.status} />
                      {s.suspendedAt ? <div className="admin-shops__suspendedAt muted">{formatDate(s.suspendedAt)}</div> : null}
                    </td>

                    <td>
                      <span className={(s.openReportCount || 0) >= 5 ? "badge badge--danger" : "badge badge--gray"}>
                        {s.openReportCount || 0}
                      </span>
                    </td>

                    {/* NOTE: Bỏ cột Điểm khỏi bảng (tạm thời không hiển thị) */}
                    {/*
        <td>
          <span className="badge badge--gray">{s.violationPoints ?? 0}</span>
        </td>
        */}

                    <td>
                      <span className={(s.strikes || 0) >= 2 ? "badge badge--danger" : "badge badge--warning"}>
                        {s.strikes ?? 0}
                      </span>
                    </td>

                    {/* NOTE: Bỏ cột Tỉ lệ hợp lệ (60d) khỏi bảng (tạm thời không hiển thị) */}
                    {/*
        <td className="admin-shops__ratio">
          {s.validRatio60d != null ? `${Math.round(s.validRatio60d * 100)}%` : "-"}
        </td>
        */}

                    <td className="admin-shops__date muted">{formatDate(s.createdAt)}</td>

                    <td className="admin-shops__tdRight">
                      <div className="admin-shops__rowActions">
                        {s.status === "PENDING" ? (
                          <>
                            <button className="btn-primary btn-sm" onClick={() => approvePending(s)} disabled={submitting} type="button">
                              Duyệt
                            </button>
                            <button className="btn-secondary btn-sm" onClick={() => rejectPending(s)} disabled={submitting} type="button">
                              Từ chối
                            </button>
                          </>
                        ) : (
                          <button className="btn-secondary btn-sm" onClick={() => openActionModal(s)} type="button">
                            Ban/Cảnh cáo
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {!shops.length ? (
                  <tr>
                    {/* NOTE: Số cột còn lại = 7 (đã bỏ 2 cột), nên colSpan đổi 9 -> 7 */}
                    <td colSpan={7} className="admin-shops__empty muted">
                      Không có shop.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

          </div>
        )}
      </div>

      <ActionModal
        open={!!actionShop}
        shop={actionShop}
        action={action}
        setAction={setAction}
        note={note}
        setNote={setNote}
        // NOTE: Không truyền props điểm vì ADJUST_POINTS đã bỏ khỏi option.
        // pointsDelta={pointsDelta}
        // setPointsDelta={setPointsDelta}
        submitting={submitting}
        onClose={closeActionModal}
        onSubmit={submitAction}
      />
    </section>
  );
}
