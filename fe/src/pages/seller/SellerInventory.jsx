import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { sellerApi } from "../../api/seller";
import { formatVnd } from "../../utils/format";

import "./SellerInventory.css";

function Badge({ children, tone = "gray" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export default function SellerInventory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [editStock, setEditStock] = useState({}); // { [skuId]: stock }
  const [savingId, setSavingId] = useState(null);

  async function load({ p = page } = {}) {
    setLoading(true);
    setError(null);
    try {
      const res = await sellerApi.listInventory({ q: q.trim() || undefined, page: p, limit: 20 });
      if (!res?.success) throw new Error(res?.message || "Không tải được tồn kho");
      setData(res.data);
      setPage(p);
      const next = {};
      (res.data?.items || []).forEach((it) => {
        next[it.id] = it.stock;
      });
      setEditStock(next);
    } catch (e) {
      setError(e?.message || "Không tải được tồn kho");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ p: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1 };

  const lowStockIds = useMemo(() => {
    const s = new Set();
    items.forEach((it) => {
      if (Number(it.stock) <= 5) s.add(it.id);
    });
    return s;
  }, [items]);

  async function saveStock(skuId) {
    const val = Number(editStock[skuId]);
    if (!Number.isFinite(val) || val < 0) {
      setError("Tồn kho không hợp lệ");
      return;
    }
    setSavingId(skuId);
    setError(null);
    try {
      const res = await sellerApi.updateSku(skuId, { stock: val });
      if (!res?.success) throw new Error(res?.message || "Không cập nhật được tồn kho");
      await load({ p: page });
    } catch (e) {
      setError(e?.message || "Không cập nhật được tồn kho");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="seller-inventory">
      <header className="seller-inventory__header">
        <div>
          <h1 className="seller-inventory__title">Tồn kho</h1>
          <p className="seller-inventory__subtitle muted">Quản lý tồn kho theo SKU và cảnh báo sắp hết hàng.</p>
        </div>
      </header>

      <div className="card seller-inventory__controls">
        <div className="seller-inventory__controlsInner">
          <div className="seller-inventory__search">
            <input
              className="input"
              placeholder="Tìm SKU / sản phẩm..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn-secondary" onClick={() => load({ p: 1 })} disabled={loading} type="button">
              Tìm
            </button>
          </div>
          <button className="btn-secondary" onClick={() => load({ p: page })} disabled={loading} type="button">
            Tải lại
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--error seller-inventory__alert">{error}</div> : null}

      <div className="card seller-inventory__tableCard">
        <div className="seller-inventory__tableWrap">
          <table className="table table--tiki seller-inventory__table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Sản phẩm</th>
                <th className="seller-inventory__thRight">Giá</th>
                <th className="seller-inventory__thRight">Giá nhập</th>
                <th className="seller-inventory__thRight">Tồn</th>
                <th>Trạng thái</th>
                <th className="seller-inventory__thRight">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="seller-inventory__tdMuted muted">
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="seller-inventory__tdMuted muted">
                    Chưa có SKU.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className={lowStockIds.has(it.id) ? "seller-inventory__rowWarn" : ""}>
                    <td>
                      <div className="seller-inventory__skuCode">{it.code}</div>
                      <div className="seller-inventory__skuName muted">{it.name}</div>
                    </td>
                    <td>
                      <Link to={`/p/${it.product?.slug}`} className="link">
                        {it.product?.name || "(ẩn)"}
                      </Link>
                      {lowStockIds.has(it.id) ? (
                        <div className="seller-inventory__lowStock">
                          <Badge tone="warning">Sắp hết</Badge>
                        </div>
                      ) : null}
                    </td>
                    <td className="seller-inventory__tdRight">{formatVnd(it.price)}</td>
                    <td className="seller-inventory__tdRight">{it.costPrice != null ? formatVnd(it.costPrice) : "—"}</td>
                    <td className="seller-inventory__tdRight seller-inventory__stockCell">
                      <div className="seller-inventory__stockEdit">
                        <input
                          type="number"
                          className="input input-sm seller-inventory__stockInput"
                          value={editStock[it.id] ?? it.stock}
                          onChange={(e) => setEditStock((s) => ({ ...s, [it.id]: e.target.value }))}
                          min={0}
                        />
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => saveStock(it.id)}
                          disabled={savingId === it.id}
                          type="button"
                        >
                          {savingId === it.id ? "..." : "Lưu"}
                        </button>
                      </div>
                    </td>
                    <td>
                      {it.status === "ACTIVE" ? <Badge tone="success">ACTIVE</Badge> : <Badge tone="gray">{it.status}</Badge>}
                    </td>
                    <td className="seller-inventory__tdRight seller-inventory__updated muted">
                      {it.updatedAt ? new Date(it.updatedAt).toLocaleString("vi-VN") : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="seller-inventory__pager">
          <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => load({ p: page - 1 })} type="button">
            Trước
          </button>
          <div className="seller-inventory__pageInfo muted">
            Trang {pagination.page || page} / {pagination.totalPages || 1}
          </div>
          <button
            className="btn-secondary"
            disabled={page >= (pagination.totalPages || 1) || loading}
            onClick={() => load({ p: page + 1 })}
            type="button"
          >
            Sau
          </button>
        </div>
      </div>
    </section>
  );
}
