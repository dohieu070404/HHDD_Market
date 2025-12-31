import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sellerApi } from "../../api/seller";
import { formatDateTime } from "../../utils/format";
import Skeleton from "../../components/ui/Skeleton";

import "./SellerNotifications.css";

function SkeletonRow() {
  return (
    <div className="card seller-notifications__skeletonCard">
      <div className="seller-notifications__skeletonTop">
        <Skeleton style={{ width: 220, height: 14 }} />
        <Skeleton style={{ width: 120, height: 14 }} />
      </div>
      <div className="seller-notifications__spacer" />
      <Skeleton style={{ width: "86%", height: 12 }} />
    </div>
  );
}

function parseData(dataJson) {
  if (!dataJson) return {};
  try {
    const obj = JSON.parse(dataJson);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export default function SellerNotifications() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await sellerApi.listNotifications();
      if (res?.success) setList(res.data || []);
      else setErr(res?.message || "Không tải được thông báo");
    } catch (e) {
      setErr(e?.data?.message || "Không tải được thông báo");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id) {
    await sellerApi.markNotificationRead(id);
    setList((s) => s.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="seller-notifications">
      <header className="seller-notifications__header">
        <div>
          <div className="seller-notifications__title">Cảnh báo & Thông báo</div>
          <div className="seller-notifications__subtitle muted">Thông báo từ admin/hệ thống về vi phạm, hạn chế, thay đổi trạng thái shop...</div>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading} type="button">
          Tải lại
        </button>
      </header>

      {err ? <div className="alert alert--error seller-notifications__alert">{err}</div> : null}

      {loading ? (
        <div className="seller-notifications__list">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : list?.length ? (
        <div className="seller-notifications__list">
          {list.map((n) => {
            const data = parseData(n.dataJson);
            const links = [];
            if (data?.orderCode) {
              links.push({
                to: `/seller/orders/${encodeURIComponent(data.orderCode)}`,
                label: `Đơn ${data.orderCode}`,
              });
            }
            if (data?.disputeId) {
              links.push({
                to: `/seller/disputes?dispute=${encodeURIComponent(data.disputeId)}`,
                label: `Khiếu nại #${data.disputeId}`,
              });
            }
            if (data?.returnId) {
              links.push({
                to: `/seller/returns?return=${encodeURIComponent(data.returnId)}`,
                label: `Yêu cầu trả hàng #${data.returnId}`,
              });
            }

            return (
              <article key={n.id} className={"card seller-notifications__item " + (!n.isRead ? "seller-notifications__item--unread" : "")}>
                <div className="seller-notifications__itemTop">
                  <div>
                    <div className="seller-notifications__itemTitle">{n.title || "Thông báo"}</div>
                    <div className="seller-notifications__itemMeta muted">{formatDateTime(n.createdAt)}</div>
                  </div>
                  {!n.isRead ? (
                    <button className="btn-secondary" onClick={() => markRead(n.id)} type="button">
                      Đánh dấu đã đọc
                    </button>
                  ) : (
                    <span className="badge">Đã đọc</span>
                  )}
                </div>
                <div className="seller-notifications__message">{n.body || n.message}</div>
                {links.length > 0 ? (
                  <div className="seller-notifications__links">
                    {links.map((l) => (
                      <Link key={l.to} to={l.to} className="seller-notifications__link">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card seller-notifications__empty">Chưa có thông báo nào.</div>
      )}
    </section>
  );
}
