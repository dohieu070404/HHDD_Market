import { useEffect, useMemo, useState } from "react";
import "./OrdersShared.css";
import "./Orders.css";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Skeleton from "../components/ui/Skeleton";
import { customerApi } from "../api/customer";
import { formatDateTime, formatOrderStatus, formatVnd } from "../utils/format";
import { useCart } from "../contexts/CartContext";

function StatusBadge({ status }) {
  const label = formatOrderStatus(status) || status;
  const cls =
    status === "DELIVERED" || status === "COMPLETED"
      ? "badge badge--success"
      : status === "CANCELLED"
        ? "badge badge--danger"
        : status?.startsWith("RETURN_") || status?.startsWith("REFUND")
          ? "badge badge--warning"
          : "badge";
  return <span className={cls}>{label}</span>;
}

function TabBar({ value, onChange }) {
  const tabs = [
    { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
    { key: "PLACED", label: "Chờ xác nhận" },
    { key: "PACKING", label: "Đang chuẩn bị" },
    { key: "SHIPPED", label: "Đang giao" },
    { key: "DELIVERED", label: "Hoàn thành" },
    { key: "RETURN", label: "Trả hàng/Hoàn tiền" },
    { key: "ALL", label: "Tất cả" },
  ];

  return (
    <div className="tabs" role="tablist" aria-label="Trạng thái đơn mua">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={"tab " + (value === t.key ? "tab--active" : "")}
          onClick={() => onChange(t.key)}
          role="tab"
          aria-selected={value === t.key}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Đóng" type="button">
            ✕
          </button>
        </div>
        <div className="modalBody">{children}</div>
        {footer ? <div className="modalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="orders-skeletonList">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card orders-skeletonCard">
          <div className="orders-skeletonCard__top">
            <Skeleton className="orders-skel orders-skel--title" />
            <Skeleton className="orders-skel orders-skel--badge" rounded="full" />
          </div>
          <div className="orders-skeletonCard__items">
            {Array.from({ length: 2 }).map((__, k) => (
              <div key={k} className="orders-skeletonItem">
                <Skeleton className="orders-skel orders-skel--thumb" rounded="lg" />
                <div className="orders-skeletonItem__lines">
                  <Skeleton className="orders-skel orders-skel--lineLg" />
                  <Skeleton className="orders-skel orders-skel--lineSm" />
                </div>
                <div className="orders-skeletonItem__price">
                  <Skeleton className="orders-skel orders-skel--price" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const tab = String(searchParams.get("status") || "ALL");

  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [error, setError] = useState(null);

  // Return/refund modal
  const [rrOpen, setRrOpen] = useState(false);
  const [rrSubmitting, setRrSubmitting] = useState(false);
  const [rrTarget, setRrTarget] = useState(null); // { orderCode }
  const [rrType, setRrType] = useState("RETURN");
  const [rrRequestType, setRrRequestType] = useState("CHANGE_MIND");
  const [rrReason, setRrReason] = useState("");

  const justOrdered = location.state?.justOrdered;
  const justGroupCode = location.state?.groupCode;

  const statusQuery = useMemo(() => {
    if (tab === "ALL") return "";
    if (tab === "RETURN") return "RETURN";
    return tab;
  }, [tab]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await customerApi.listOrders({ page, limit: 10, ...(statusQuery ? { status: statusQuery } : {}) });
        if (res?.success) {
          setData(res.data);
        } else {
          setError(res?.message || "Không tải được danh sách đơn mua");
        }
      } catch {
        setError("Không tải được danh sách đơn mua");
      } finally {
        setLoading(false);
      }
    })();
  }, [page, statusQuery]);

  function setTab(next) {
    const sp = new URLSearchParams(searchParams);
    sp.set("status", next);
    sp.set("page", "1");
    setSearchParams(sp);
  }

  function setPage(p) {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(p));
    setSearchParams(sp);
  }

  function openReturnRefund(orderCode) {
    setRrTarget({ orderCode });
    setRrType("RETURN");
    setRrRequestType("CHANGE_MIND");
    setRrReason("");
    setRrOpen(true);
  }

  async function submitReturnRefund() {
    if (!rrTarget) return;
    const reason = rrReason.trim();
    if (reason.length < 3) {
      alert("Vui lòng nhập lý do (tối thiểu 3 ký tự)");
      return;
    }

    setRrSubmitting(true);
    try {
      const res =
        rrType === "REFUND"
          ? await customerApi.refundRequest(rrTarget.orderCode, reason)
          : await customerApi.returnRequest(rrTarget.orderCode, { reason, requestType: rrRequestType });
      if (!res?.success) throw new Error(res?.message || "Không gửi được yêu cầu");

      const refreshed = await customerApi.listOrders({ page, limit: 10, ...(statusQuery ? { status: statusQuery } : {}) });
      if (refreshed?.success) setData(refreshed.data);
      setRrOpen(false);
    } catch (e) {
      alert(e?.message || "Không gửi được yêu cầu");
    } finally {
      setRrSubmitting(false);
    }
  }

  async function reorder(orderCode) {
    try {
      const res = await customerApi.reorder(orderCode);
      if (!res?.success) throw new Error(res?.message || "Không mua lại được");
      const lineItems = res.data || [];
      const skuIds = Array.from(new Set(lineItems.map((x) => Number(x.skuId)).filter(Boolean)));
      const lookup = skuIds.length ? await customerApi.lookupSkus(skuIds) : { success: true, data: [] };
      if (!lookup?.success) throw new Error(lookup?.message || "Không lấy được thông tin sản phẩm");

      const skuMap = new Map((lookup.data || []).map((s) => [Number(s.skuId), s]));
      let added = 0;
      let skipped = 0;
      for (const li of lineItems) {
        const skuId = Number(li.skuId);
        const qty = Number(li.qty || 1);
        const sku = skuMap.get(skuId);
        if (!sku || sku.status !== "ACTIVE" || sku.productStatus !== "ACTIVE" || sku.stock <= 0) {
          skipped += 1;
          continue;
        }
        cart.addItem(
          {
            skuId,
            name: sku.name,
            skuName: sku.skuName,
            // price: sku.price,
            price: Number(sku.price ?? 0),
            thumbnailUrl: sku.thumbnailUrl,
            shop: sku.shop,
          },
          qty
        );
        added += 1;
      }

      navigate("/cart", { state: { added, skipped } });
    } catch (e) {
      alert(e?.message || "Không mua lại được");
    }
  }

  return (
    <div className="orders-page">
      <div className="container-page orders-page__container">
        <div className="orders-header">
          <div>
            <h1 className="orders-header__title">Đơn mua</h1>
            <p className="orders-header__subtitle muted">Theo dõi đơn, trả hàng/hoàn tiền và đánh giá sản phẩm.</p>
          </div>
          <Link to="/products" className="btn-secondary">
            Tiếp tục mua sắm
          </Link>
        </div>

        {justOrdered ? (
          <div className="orders-alert alert alert--success">
            <div className="orders-alert__title">Đặt hàng thành công!</div>
            {justGroupCode ? (
              <div className="orders-alert__meta">
                Bạn có thể xem nhóm đơn tại: <Link to={`/orders/${justGroupCode}`} className="link">{justGroupCode}</Link>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="orders-tabsWrap">
          <TabBar value={tab} onChange={setTab} />
        </div>

        <div className="orders-content">
          {loading ? (
            <OrdersSkeleton />
          ) : error ? (
            <div className="alert alert--danger">{error}</div>
          ) : data.items?.length ? (
            <div className="orders-list">
              {data.items.map((o) => {
                // Treat RETURN_REJECTED as "done" for review purposes (order is kept by buyer).
                const isDone = ["DELIVERED", "COMPLETED", "RETURN_REJECTED"].includes(o.status);
                const canRR = isDone && !String(o.status).startsWith("RETURN_") && !String(o.status).startsWith("REFUND");
                const hasUnreviewed = isDone && (o.items || []).some((it) => !it.hasReview);

                return (
                  <div key={o.code} className="card orders-orderCard">
                    <div className="orderCardHeader">
                      <div className="orders-orderCard__shopRow">
                        <span className="orders-orderCard__shopName">{o.shop?.name || "Shop"}</span>
                        <span className="orders-orderCard__date muted">· {formatDateTime(o.createdAt)}</span>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    <div className="orders-orderCard__body">
                      <div className="orders-orderCard__items">
                        {(o.items || []).map((it) => (
                          <div key={it.id} className="orderItemRow">
                            <div className="orderThumb">
                              {it.product?.thumbnailUrl ? <img src={it.product.thumbnailUrl} alt={it.name} /> : <div className="thumb-fallback" />}
                            </div>

                            <div className="orders-orderItem__content">
                              <div className="orders-orderItem__row">
                                <div className="orders-orderItem__main">
                                  <div className="orders-orderItem__name">{it.name}</div>
                                  <div className="orders-orderItem__meta muted">
                                    {it.variantName ? `${it.variantName} · ` : ""}x{it.qty}
                                  </div>

                                  {isDone ? (
                                    <div className="orders-orderItem__actions">
                                      {it.hasReview ? (
                                        <span className="pill">Đã đánh giá</span>
                                      ) : (
                                        <button
                                          className="btn-secondary btn-sm"
                                          onClick={() => navigate(`/reviews?product=${encodeURIComponent(String(it.productId))}`)}
                                        >
                                          Đánh giá
                                        </button>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="orders-orderItem__price">
                                  <div className="orders-orderItem__unit muted">{formatVnd(it.price)}</div>
                                  <div className="orders-orderItem__sum">{formatVnd(it.price * it.qty)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="orders-orderCard__footer">
                        <div className="orders-orderCard__total muted">
                          Tổng thanh toán: <span className="orders-orderCard__totalValue">{formatVnd(o.total)}</span>
                        </div>

                        <div className="orders-orderCard__actions">
                          <button className="btn-secondary btn-sm" onClick={() => reorder(o.code)}>
                            Mua lại
                          </button>
                          {canRR ? (
                            <button className="btn-secondary btn-sm" onClick={() => openReturnRefund(o.code)}>
                              Trả hàng/Hoàn tiền
                            </button>
                          ) : null}
                          <button className="btn btn-sm" onClick={() => navigate(`/orders/o/${o.code}`)}>
                            Xem chi tiết
                          </button>
                        </div>
                      </div>

                      {hasUnreviewed && tab !== "DELIVERED" ? (
                        <div className="orders-hint muted">Mẹo: Bạn có thể đánh giá từng sản phẩm sau khi nhận hàng.</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              <div className="orders-pagination">
                <button className="btn-secondary" disabled={data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}>
                  Trang trước
                </button>
                <div className="orders-pagination__info muted">
                  Trang {data.pagination.page} / {data.pagination.totalPages}
                </div>
                <button
                  className="btn-secondary"
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  onClick={() => setPage(data.pagination.page + 1)}
                >
                  Trang sau
                </button>
              </div>
            </div>
          ) : (
            <div className="card orders-emptyCard">Chưa có đơn mua nào.</div>
          )}
        </div>

        <Modal
          open={rrOpen}
          title="Trả hàng / Hoàn tiền"
          onClose={() => (rrSubmitting ? null : setRrOpen(false))}
          footer={
            <div className="orders-modalFooter">
              <button className="btn-secondary" onClick={() => setRrOpen(false)} disabled={rrSubmitting}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={submitReturnRefund} disabled={rrSubmitting}>
                {rrSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </button>
            </div>
          }
        >
          <div className="segmented" role="group" aria-label="Loại yêu cầu">
            <button type="button" className={"segmented__btn" + (rrType === "RETURN" ? " is-active" : "")} onClick={() => setRrType("RETURN")}>
              Trả hàng / Đổi hàng
            </button>
            <button type="button" className={"segmented__btn" + (rrType === "REFUND" ? " is-active" : "")} onClick={() => setRrType("REFUND")}>
              Hoàn tiền
            </button>
          </div>

          <div className="orders-rrForm">
            {rrType === "RETURN" ? (
              <div className="orders-rrForm__block">
                <div className="orders-rrForm__label muted">Phân loại</div>
                <select className="select orders-rrForm__control" value={rrRequestType} onChange={(e) => setRrRequestType(e.target.value)}>
                  <option value="CHANGE_MIND">Đổi ý / Không còn nhu cầu</option>
                  <option value="DEFECTIVE">Hàng lỗi / Không hoạt động</option>
                  <option value="WRONG_ITEM">Giao sai sản phẩm / Sai phân loại</option>
                  <option value="NOT_AS_DESCRIBED">Không đúng mô tả</option>
                  <option value="OTHER">Khác</option>
                </select>
                <div className="orders-rrForm__hint muted">
                  * Một số trường hợp "đổi ý" có thể bị khấu trừ phí xử lý theo chính sách của shop.
                </div>
              </div>
            ) : null}

            <div className="orders-rrForm__block">
              <div className="orders-rrForm__label muted">Lý do</div>
              <textarea
                className="textarea orders-rrForm__control"
                rows={4}
                value={rrReason}
                onChange={(e) => setRrReason(e.target.value)}
                placeholder={rrType === "REFUND" ? "Lý do muốn hoàn tiền..." : "Lý do muốn trả/đổi hàng..."}
              />
              <div className="orders-rrForm__hint muted">* Demo: hệ thống sẽ tạo yêu cầu và cập nhật trạng thái đơn.</div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
