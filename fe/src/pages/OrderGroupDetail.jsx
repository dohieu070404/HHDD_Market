import { useEffect, useMemo, useState } from "react";
import "./OrderGroupDetail.css";
import { Link, useNavigate, useParams } from "react-router-dom";
import { customerApi } from "../api/customer";
import { formatDateTime, formatOrderStatus, formatVnd } from "../utils/format";

function StatusPill({ status }) {
  const label = formatOrderStatus(status) || status || "-";
  const cls =
    status === "DELIVERED"
      ? "status-pill status-pill--success"
      : status === "CANCELLED"
      ? "status-pill status-pill--danger"
      : "status-pill";
  return <span className={cls}>{label}</span>;
}

export default function OrderGroupDetail() {
  const { code } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  const orders = group?.orders || [];
  const shops = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const s = o.shop;
      if (s && !map.has(s.id)) map.set(s.id, s);
    }
    return Array.from(map.values());
  }, [orders]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await customerApi.getOrderGroup(code);
        if (res?.success) {
          setGroup(res.data);
          setError(null);
        } else {
          setError(res?.message || "Không tải được đơn hàng");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  if (loading) {
    return (
      <div className="order-group-page">
        <div className="container-page order-group-page__container">
          <div className="card order-group-loading">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="order-group-page">
        <div className="container-page order-group-page__container">
          <div className="alert alert--error order-group-page__alert">{error}</div>
          <div className="order-group-page__back">
            <button className="btn-secondary" onClick={() => nav(-1)}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="order-group-page">
      <div className="container-page order-group-page__container">
        <div className="order-group-header">
          <div>
            <div className="order-group-header__label muted">Mã đơn</div>
            <h1 className="order-group-header__title">{group.groupCode}</h1>
            <div className="order-group-header__meta muted">
              {shops.length > 1 ? `Đơn này gồm ${shops.length} shop` : shops[0]?.name || ""}
            </div>
          </div>

          <div className="order-group-header__actions">
            <button className="btn-secondary" onClick={() => nav(-1)}>
              Quay lại
            </button>
            <Link to="/orders" className="btn">
              Danh sách đơn
            </Link>
          </div>
        </div>

        <div className="card order-group-summary">
          <div className="order-group-summary__row">
            <div>
              <div className="order-group-summary__label muted">Trạng thái</div>
              <div className="order-group-summary__value">
                <StatusPill status={group.status} />
              </div>
            </div>
            <div className="order-group-summary__right">
              <div className="order-group-summary__label muted">Tổng tiền</div>
              <div className="order-group-summary__total">{formatVnd(group.total)}</div>
              <div className="order-group-summary__time muted">{formatDateTime(group.createdAt)}</div>
            </div>
          </div>
        </div>

        <div className="order-group-orders">
          <div className="order-group-orders__title">Đơn con theo từng shop</div>

          <div className="order-group-orders__list">
            {orders.map((o) => (
              <div key={o.code} className="card order-child">
                <div className="order-child__head">
                  <div>
                    <div className="order-child__label muted">Shop</div>
                    <div className="order-child__shop">{o.shop?.name || ""}</div>
                    <div className="order-child__meta muted">
                      Mã đơn con: <b>{o.code}</b>
                    </div>
                  </div>
                  <div className="order-child__right">
                    <StatusPill status={o.status} />
                    <div className="order-child__total">{formatVnd(o.total)}</div>
                    <div className="order-child__time muted">{formatDateTime(o.createdAt)}</div>
                  </div>
                </div>

                <div className="order-child__items">
                  {(o.items || []).slice(0, 4).map((it) => (
                    <div key={it.id} className="order-child__itemRow">
                      <div className="order-child__itemName">
                        {it.name}{" "}
                        {it.variantName ? <span className="muted">({it.variantName})</span> : null}
                        <span className="muted"> × {it.qty}</span>
                      </div>
                      <div className="order-child__itemPrice muted">{formatVnd(it.price * it.qty)}</div>
                    </div>
                  ))}
                  {(o.items || []).length > 4 ? (
                    <div className="order-child__more muted">+ {(o.items || []).length - 4} sản phẩm khác</div>
                  ) : null}
                </div>

                <div className="order-child__actions">
                  <Link to={`/orders/o/${o.code}`} className="btn">
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
