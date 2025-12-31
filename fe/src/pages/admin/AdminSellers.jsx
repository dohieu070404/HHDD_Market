import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";
import { useAuth } from "../../contexts/AuthContext";
import { formatDate } from "../../utils/format";

import "./AdminSellers.css";

function StatusPill({ status }) {
  const map = {
    PENDING: { label: "Chờ duyệt", cls: "badge badge--warning" },
    APPROVED: { label: "Đã duyệt", cls: "badge badge--success" },
    REJECTED: { label: "Từ chối", cls: "badge badge--danger" },
  };
  const v = map[status] || { label: status || "-", cls: "badge" };
  return <span className={v.cls}>{v.label}</span>;
}

export default function AdminSellers() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await adminApi.listSellers(status);
      if (!res?.success) throw new Error(res?.message || "Không tải được danh sách.");
      setItems(res.data || []);
    } catch (e) {
      setMsg(e.message || "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }

  const { user } = useAuth();
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const countText = useMemo(() => `${items.length} hồ sơ`, [items]);

  async function approve(userId) {
    if (!window.confirm("Duyệt shop này?")) return;
    try {
      await adminApi.approveSeller(userId);
      await load();
    } catch (e) {
      alert(e.message || "Không duyệt được.");
    }
  }

  async function reject(userId) {
    const reason = window.prompt("Lý do từ chối (bắt buộc):", "Thông tin chưa hợp lệ");
    if (!reason) return;
    try {
      await adminApi.rejectSeller(userId, reason);
      await load();
    } catch (e) {
      alert(e.message || "Không từ chối được.");
    }
  }

  return (
    <section className="admin-sellers">
      <header className="card admin-sellers__headerCard">
        <div className="admin-sellers__header">
          <div>
            <div className="admin-sellers__title">Duyệt hồ sơ mở Shop</div>
            <div className="admin-sellers__subtitle muted">{countText}</div>
          </div>
          <div className="admin-sellers__filters">
            <label className="admin-sellers__filterLabel">Trạng thái</label>
            <select className="select select-sm admin-sellers__select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>
        </div>
      </header>

      {msg ? <div className="alert alert--danger admin-sellers__alert">{msg}</div> : null}

      <div className="card admin-sellers__tableCard">
        <div className="admin-sellers__tableWrap">
          <table className="table table--tiki admin-sellers__table">
            <thead>
              <tr>
                <th>User</th>
                <th>Shop</th>
                <th>Phone</th>
                <th>Tax ID</th>
                <th>Status</th>
                <th className="admin-sellers__thRight">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="admin-sellers__tdMuted muted" colSpan={6}>
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="admin-sellers__tdMuted muted" colSpan={6}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="admin-sellers__row">
                    <td>
                      <div className="admin-sellers__userName">{it.user?.username || it.user?.email}</div>
                      <div className="admin-sellers__userEmail muted">{it.user?.email}</div>
                    </td>
                    <td>
                      <div className="admin-sellers__shopName">{it.shop?.name || it.shopName || "—"}</div>
                      <div className="admin-sellers__shopSlug muted">/{it.shop?.slug || "—"}</div>

                      {it.kycDocumentUrl ? (
                        <a className="admin-sellers__kycLink" href={it.kycDocumentUrl} target="_blank" rel="noreferrer">
                          Xem giấy tờ KYC
                        </a>
                      ) : null}

                      {it.createdAt ? <div className="admin-sellers__createdAt muted">Gửi: {formatDate(it.createdAt)}</div> : null}

                      {it.status === "REJECTED" && it.rejectedReason ? (
                        <div className="admin-sellers__rejectReason">Lý do: {it.rejectedReason}</div>
                      ) : null}
                    </td>
                    <td>{it.phone || "—"}</td>
                    <td>{it.taxId || "—"}</td>
                    <td>
                      <StatusPill status={it.status} />
                    </td>
                    <td className="admin-sellers__tdRight">
                      {it.status === "PENDING" ? (
                        user?.role === "ADMIN" ? (
                          <div className="admin-sellers__actions">
                            <button className="btn-primary btn-sm" onClick={() => approve(it.userId)} type="button">
                              Duyệt
                            </button>
                            <button className="btn-secondary btn-sm" onClick={() => reject(it.userId)} type="button">
                              Từ chối
                            </button>
                          </div>
                        ) : (
                          <span className="admin-sellers__noPermission muted">Chỉ Admin có quyền duyệt/từ chối</span>
                        )
                      ) : (
                        <span className="admin-sellers__dash muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
