import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";
import Skeleton from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import { formatDateTime, formatVnd } from "../../utils/format";

import "./AdminShopVouchers.css";

function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function normalizePayload(form, shopId) {
  const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
  return {
    shopId: Number(shopId),
    code: String(form.code || "").trim(),
    type: form.type,
    value: Number(form.value || 0),
    minSubtotal: num(form.minSubtotal) ?? 0,
    maxDiscount: form.maxDiscount === "" ? null : num(form.maxDiscount),
    usageLimit: form.usageLimit === "" ? null : num(form.usageLimit),
    startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
    endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
    isActive: !!form.isActive,
    minBuyerSpendMonth: num(form.minBuyerSpendMonth) ?? 0,
    minBuyerSpendYear: num(form.minBuyerSpendYear) ?? 0,
  };
}

export default function AdminShopVouchers() {
  const [shops, setShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopsError, setShopsError] = useState(null);

  const [shopId, setShopId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [openForm, setOpenForm] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    type: "PERCENT",
    value: 10,
    minSubtotal: 0,
    maxDiscount: "",
    usageLimit: "",
    startAt: "",
    endAt: "",
    isActive: true,
    minBuyerSpendMonth: 0,
    minBuyerSpendYear: 0,
  });

  const isEditing = useMemo(() => editingId != null, [editingId]);

  async function fetchShops() {
    setShopsLoading(true);
    setShopsError(null);
    try {
      const res = await adminApi.listShops({ q: "", status: "" });
      if (!res?.success) throw new Error(res?.message || "Không tải được shop");
      const list = res.data || [];
      setShops(list);
      if (!shopId && list.length) setShopId(String(list[0].id));
    } catch (e) {
      setShopsError(e?.message || "Không tải được shop");
    } finally {
      setShopsLoading(false);
    }
  }

  async function fetchList(selectedShopId = shopId) {
    if (!selectedShopId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listShopVouchers(Number(selectedShopId));
      if (res?.success) setRows(res.data || []);
      else setError(res?.message || "Không tải được voucher shop");
    } catch (e) {
      setError(e?.message || "Không tải được voucher shop");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shopId) fetchList(shopId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const formDefault = useMemo(
    () => ({
      code: "",
      type: "PERCENT",
      value: 10,
      minSubtotal: 0,
      maxDiscount: "",
      usageLimit: "",
      startAt: "",
      endAt: "",
      isActive: true,
      minBuyerSpendMonth: 0,
      minBuyerSpendYear: 0,
    }),
    []
  );

  function resetForm() {
    setEditingId(null);
    setForm(formDefault);
  }

  function openCreate() {
    setError(null);
    resetForm();
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
  }

  function cancelForm() {
    setOpenForm(false);
    resetForm();
  }

  function startEdit(v) {
    setEditingId(v.id);
    setForm({
      code: v.code || "",
      type: v.type || "PERCENT",
      value: v.value ?? 0,
      minSubtotal: v.minSubtotal ?? 0,
      maxDiscount: v.maxDiscount == null ? "" : v.maxDiscount,
      usageLimit: v.usageLimit == null ? "" : v.usageLimit,
      startAt: toInputDateTime(v.startAt),
      endAt: toInputDateTime(v.endAt),
      isActive: v.isActive ?? true,
      minBuyerSpendMonth: v.minBuyerSpendMonth ?? 0,
      minBuyerSpendYear: v.minBuyerSpendYear ?? 0,
    });
    setOpenForm(true);
  }

  async function save() {
    if (!shopId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = normalizePayload(form, shopId);
      if (!payload.code) throw new Error("Vui lòng nhập mã voucher");

      let res;
      if (isEditing) res = await adminApi.updateShopVoucher(editingId, payload);
      else res = await adminApi.createShopVoucher(payload);

      if (!res?.success) throw new Error(res?.message || "Không lưu được voucher shop");

      resetForm();
      setOpenForm(false);
      await fetchList(shopId);
    } catch (e) {
      setError(e?.message || "Không lưu được voucher shop");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id) {
    if (!confirm("Tắt voucher shop này? (set isActive=false)")) return;
    try {
      const res = await adminApi.deleteShopVoucher(id);
      if (!res?.success) throw new Error(res?.message || "Không tắt được voucher");
      await fetchList(shopId);
    } catch (e) {
      setError(e?.message || "Không tắt được voucher");
    }
  }

  function renderValue(v) {
    return v.type === "PERCENT" ? `${v.value}%` : formatVnd(v.value);
  }

  const selectedShop = shops.find((s) => String(s.id) === String(shopId));

  return (
    <section className="admin-shop-vouchers">
      <div className="admin-shop-vouchers__header">
        <div>
          <h1 className="admin-shop-vouchers__title">Voucher theo shop</h1>
          <p className="muted admin-shop-vouchers__subtitle">
            Admin có thể tạo voucher cho từng shop (kèm điều kiện khách hàng cũ).
          </p>
        </div>
        <button className="btn-primary" onClick={openCreate} type="button">
          + Tạo voucher
        </button>
      </div>

      {shopsError ? (
        <div className="alert alert--danger admin-shop-vouchers__alert">{shopsError}</div>
      ) : null}
      {error ? <div className="alert alert--danger admin-shop-vouchers__alert">{error}</div> : null}

      <div className="card admin-shop-vouchers__shopCard">
        <div className="admin-shop-vouchers__shopHead">
          <div>
            <div className="admin-shop-vouchers__cardTitle">Chọn shop</div>
            <div className="muted admin-shop-vouchers__shopHint">Voucher sẽ áp dụng riêng cho shop được chọn.</div>
          </div>

          {shopsLoading ? (
            <Skeleton style={{ height: 40, width: 320 }} />
          ) : (
            <select
              className="select admin-shop-vouchers__shopSelect"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (#{s.id})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="card admin-shop-vouchers__listCard">
          <div className="admin-shop-vouchers__listHead">
            <div className="admin-shop-vouchers__cardTitle">Voucher của shop</div>
            <button className="btn btn-ghost btn-sm" onClick={() => fetchList(shopId)} disabled={!shopId} type="button">
              Reload
            </button>
          </div>

          {loading ? (
            <div className="admin-shop-vouchers__skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 32, width: "100%" }} />
              ))}
            </div>
          ) : rows.length ? (
            <div className="admin-shop-vouchers__tableWrap">
              <table className="table table--tiki table--fixed admin-shop-vouchers__table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Giá trị</th>
                    <th>Điều kiện</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th className="admin-shop-vouchers__thRight"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td className="admin-shop-vouchers__code">{v.code}</td>
                      <td>{renderValue(v)}</td>
                      <td className="admin-shop-vouchers__conditions">
                        <div>Tối thiểu: {formatVnd(v.minSubtotal || 0)}</div>
                        {v.minBuyerSpendMonth ? <div className="muted">KH cũ tháng: {formatVnd(v.minBuyerSpendMonth)}</div> : null}
                        {v.minBuyerSpendYear ? <div className="muted">KH cũ năm: {formatVnd(v.minBuyerSpendYear)}</div> : null}
                      </td>
                      <td className="admin-shop-vouchers__validity">
                        <div>{v.startAt ? formatDateTime(v.startAt) : "—"}</div>
                        <div>{v.endAt ? formatDateTime(v.endAt) : "—"}</div>
                      </td>
                      <td>
                        {v.isActive ? <span className="badge">Active</span> : <span className="badge">Off</span>}
                        <div className="muted admin-shop-vouchers__used">
                          Used {v.usedCount || 0}
                          {v.usageLimit ? `/${v.usageLimit}` : ""}
                        </div>
                      </td>
                      <td className="admin-shop-vouchers__tdRight">
                        <div className="admin-shop-vouchers__rowActions">
                          <button className="btn-secondary btn-sm" onClick={() => startEdit(v)} type="button">
                            Sửa
                          </button>
                          <button className="btn-ghost btn-sm" onClick={() => deactivate(v.id)} type="button">
                            Tắt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="muted admin-shop-vouchers__footNote">
                “Tắt” voucher sẽ set <b>isActive=false</b> để giữ lịch sử đối soát.
              </div>
            </div>
          ) : (
            <div className="admin-shop-vouchers__empty muted">Shop này chưa có voucher.</div>
          )}
      </div>

      <Modal
        open={openForm}
        title={isEditing ? "Cập nhật voucher shop" : "Tạo voucher shop"}
        onClose={cancelForm}
        maxWidth="860px"
        footer={
          <div className="admin-shop-vouchers__modalActions">
            <button className="btn-secondary btn-sm" onClick={cancelForm} disabled={saving} type="button">
              Huỷ
            </button>
            <button className="btn-primary btn-sm" onClick={save} disabled={saving || !shopId} type="button">
              {saving ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo voucher"}
            </button>
          </div>
        }
      >
        <div className="admin-shop-vouchers__modalNote muted">
          {selectedShop ? (
            <>Shop: <b>{selectedShop.name}</b></>
          ) : (
            <>Vui lòng chọn shop trước khi tạo voucher.</>
          )}
        </div>

        <div className="admin-shop-vouchers__form">
          <div>
            <div className="label admin-shop-vouchers__label">Mã voucher</div>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="VD: SHOP10 / GIA_DUNG5"
            />
          </div>

          <div className="admin-shop-vouchers__grid2">
            <div>
              <div className="label admin-shop-vouchers__label">Loại</div>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENT">Giảm %</option>
                <option value="FIXED">Giảm tiền</option>
              </select>
            </div>
            <div>
              <div className="label admin-shop-vouchers__label">Giá trị</div>
              <input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
          </div>

          <div className="admin-shop-vouchers__grid2">
            <div>
              <div className="label admin-shop-vouchers__label">Đơn tối thiểu</div>
              <input className="input" type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </div>
            <div>
              <div className="label admin-shop-vouchers__label">Giảm tối đa (nếu %)</div>
              <input
                className="input"
                type="number"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                placeholder="Bỏ trống = không giới hạn"
              />
            </div>
          </div>

          <div className="admin-shop-vouchers__grid2">
            <div>
              <div className="label admin-shop-vouchers__label">Điều kiện KH cũ (tháng)</div>
              <input className="input" type="number" value={form.minBuyerSpendMonth} onChange={(e) => setForm({ ...form, minBuyerSpendMonth: e.target.value })} />
            </div>
            <div>
              <div className="label admin-shop-vouchers__label">Điều kiện KH cũ (năm)</div>
              <input className="input" type="number" value={form.minBuyerSpendYear} onChange={(e) => setForm({ ...form, minBuyerSpendYear: e.target.value })} />
            </div>
          </div>

          <div className="admin-shop-vouchers__grid2">
            <div>
              <div className="label admin-shop-vouchers__label">Bắt đầu</div>
              <input className="input" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div>
              <div className="label admin-shop-vouchers__label">Kết thúc</div>
              <input className="input" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>

          <div className="admin-shop-vouchers__grid2">
            <div>
              <div className="label admin-shop-vouchers__label">Giới hạn lượt dùng</div>
              <input
                className="input"
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="Bỏ trống = không giới hạn"
              />
            </div>
            <div className="admin-shop-vouchers__checkRow">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="admin-shop-vouchers__checkLabel">Kích hoạt</span>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
