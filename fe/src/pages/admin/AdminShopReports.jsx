import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../../api/admin";
import { formatDate } from "../../utils/format";

import "./AdminShopReports.css";

const STATUS_LABEL = {
  OPEN: "Mở",
  RESOLVED: "Đã xử lý",
  DISMISSED: "Bỏ qua",
};

const RESOLUTION_LABEL = {
  PENDING: "Chờ",
  VALID: "Hợp lệ",
  INVALID: "Không hợp lệ",
  ABUSIVE: "Lạm dụng",
  DUPLICATE: "Trùng lặp",
};

function Badge({ status }) {
  let variant = "badge--gray";
  if (status === "OPEN") variant = "badge--warning";
  if (status === "RESOLVED") variant = "badge--success";
  if (status === "DISMISSED") variant = "badge--gray";
  return <span className={`badge ${variant}`}>{STATUS_LABEL[status] || status}</span>;
}

export default function AdminShopReports() {
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);

  async function load() {
    try {
      setLoading(true);
      const res = await adminApi.listShopReports({ status: status || undefined });
      if (res?.success) {
        setItems(res.data || []);
        setError(null);
      } else {
        setError(res?.message || "Không tải được báo cáo");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function resolve(report) {
    const resolution = (
      window.prompt("Nhập kết quả xử lý (VALID / INVALID / ABUSIVE / DUPLICATE):", "VALID") || ""
    ).toUpperCase();
    if (!resolution) return;
    if (!["VALID", "INVALID", "ABUSIVE", "DUPLICATE"].includes(resolution)) {
      window.alert("Giá trị không hợp lệ");
      return;
    }

    let severity;
    let pointsApplied;

    if (resolution === "VALID") {
      severity = (
        window.prompt("Chọn mức độ (LOW/MEDIUM/HIGH/CRITICAL):", (report.severity || "LOW").toUpperCase()) || ""
      ).toUpperCase();
      if (!severity) severity = "LOW";
      if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(severity)) {
        window.alert("Severity không hợp lệ");
        return;
      }

      const p = window.prompt("Điểm vi phạm (bỏ trống để dùng mặc định theo severity):", "");
      if (p && String(p).trim() !== "") {
        const n = Number(p);
        if (!Number.isFinite(n) || n < 0) {
          window.alert("Điểm không hợp lệ");
          return;
        }
        pointsApplied = n;
      }
    }

    const note = window.prompt("Ghi chú xử lý (tuỳ chọn):", "") || undefined;
    await adminApi.resolveShopReport(report.id, { resolution, severity, pointsApplied, note });
    await load();
  }

  return (
    <section className="admin-shop-reports">
      <div className="admin-shop-reports__header">
        <div>
          <h1 className="admin-shop-reports__title">Báo cáo shop</h1>
          <p className="admin-shop-reports__subtitle muted">Theo dõi và xử lý các báo cáo từ người mua.</p>
        </div>

        <div className="admin-shop-reports__filters">
          <select className="input admin-shop-reports__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="OPEN">Mở</option>
            <option value="RESOLVED">Đã xử lý</option>
            <option value="DISMISSED">Bỏ qua</option>
          </select>
          <button className="btn-secondary btn-sm" onClick={load} type="button">
            Làm mới
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card admin-shop-reports__state">Đang tải...</div>
      ) : error ? (
        <div className="alert alert--danger admin-shop-reports__alert">{error}</div>
      ) : (
        <div className="card admin-shop-reports__tableCard">
          <div className="admin-shop-reports__tableWrap">
            <table className="table table--tiki admin-shop-reports__table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Người báo cáo</th>
                  <th>Lý do</th>
                  <th>Verified</th>
                  <th>Severity</th>
                  <th>Kết quả</th>
                  <th>Điểm</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                  <th className="admin-shop-reports__thRight">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="admin-shop-reports__shopName">{r.shop?.name || "-"}</div>
                      {r.shop?.slug ? (
                        <Link className="admin-shop-reports__shopLink" to={`/shop/${r.shop.slug}`}>
                          Xem shop
                        </Link>
                      ) : null}
                      <div className="admin-shop-reports__shopStatus">
                        <span
                          className={`badge ${
                            r.shop?.status === "ACTIVE"
                              ? "badge--success"
                              : r.shop?.status === "SUSPENDED"
                                ? "badge--danger"
                                : "badge--gray"
                          }`}
                        >
                          {r.shop?.status || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="admin-shop-reports__reporter">{r.reporter?.email || r.reporter?.username || "-"}</td>
                    <td>
                      <div className="admin-shop-reports__reason">{r.reason}</div>
                      {r.description ? <div className="admin-shop-reports__desc">{r.description}</div> : null}
                    </td>
                    <td>
                      {r.isVerifiedPurchase ? <span className="badge badge--success">Verified</span> : <span className="badge badge--gray">No</span>}
                    </td>
                    <td className="admin-shop-reports__severity">{r.severity || "-"}</td>
                    <td>
                      <div className="admin-shop-reports__resolution">{RESOLUTION_LABEL[r.resolution] || r.resolution || "-"}</div>
                      {r.resolutionNote ? <div className="admin-shop-reports__resolutionNote">{r.resolutionNote}</div> : null}
                    </td>
                    <td className="admin-shop-reports__points">{r.pointsApplied ? `+${r.pointsApplied}` : "-"}</td>
                    <td>
                      <Badge status={r.status} />
                    </td>
                    <td className="admin-shop-reports__date">{formatDate(r.createdAt)}</td>
                    <td className="admin-shop-reports__tdRight">
                      {r.status === "OPEN" ? (
                        <div className="admin-shop-reports__actions">
                          <button className="btn-primary btn-sm" onClick={() => resolve(r)} type="button">
                            Xử lý
                          </button>
                        </div>
                      ) : (
                        <span className="admin-shop-reports__resolvedNote muted">
                          {r.resolvedAt ? `Resolved: ${formatDate(r.resolvedAt)}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {!items.length ? (
                  <tr>
                    <td colSpan={10} className="admin-shop-reports__empty">
                      Không có báo cáo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
