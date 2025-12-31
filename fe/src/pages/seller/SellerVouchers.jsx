import { useEffect, useMemo, useState } from "react";
import { sellerApi } from "../../api/seller";
import Skeleton from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import { formatDateTime, formatVnd } from "../../utils/format";

import "./SellerVouchers.css";

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

function normalizePayload(form) {
  const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
  return {
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

export default function SellerVouchers() {
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

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await sellerApi.listVouchers();
      if (res?.success) setRows(res.data || []);
      else setError(res?.message || "Không tải được voucher");
    } catch (e) {
      setError(e?.message || "Không tải được voucher");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchList();
  }, []);

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
    setEditingId(null);
    setForm(formDefault);
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
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
    setSaving(true);
    setError(null);
    try {
      const payload = normalizePayload(form);
      if (!payload.code) throw new Error("Vui lòng nhập mã voucher");

      let res;
      if (isEditing) res = await sellerApi.updateVoucher(editingId, payload);
      else res = await sellerApi.createVoucher(payload);

      if (!res?.success) throw new Error(res?.message || "Không lưu được voucher");

      resetForm();
      setOpenForm(false);
      await fetchList();
    } catch (e) {
      setError(e?.message || "Không lưu được voucher");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Xoá voucher này?")) return;
    try {
      const res = await sellerApi.deleteVoucher(id);
      if (!res?.success) throw new Error(res?.message || "Không xoá được voucher");
      await fetchList();
    } catch (e) {
      setError(e?.message || "Không xoá được voucher");
    }
  }

  function renderValue(v) {
    return v.type === "PERCENT" ? `${v.value}%` : formatVnd(v.value);
  }

  return (
    <section className="seller-vouchers">
      <header className="seller-vouchers__header">
        <div>
          <h1 className="seller-vouchers__title">Voucher của shop</h1>
          <p className="seller-vouchers__subtitle muted">Tạo và quản lý mã giảm giá cho khách hàng.</p>
        </div>
        <div className="seller-vouchers__headerActions">
          <button className="btn-primary" onClick={openCreate} type="button">
            + Tạo voucher
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchList} type="button">
            Reload
          </button>
        </div>
      </header>

      {error ? <div className="alert alert--danger seller-vouchers__alert">{error}</div> : null}

      <div className="card seller-vouchers__listCard">
        <div className="seller-vouchers__listHead">
          <div className="seller-vouchers__cardTitle">Danh sách voucher</div>
          <div className="seller-vouchers__listActions">
            <button className="btn btn-ghost btn-sm" onClick={fetchList} type="button">
              Reload
            </button>
          </div>
        </div>

        {loading ? (
          <div className="seller-vouchers__skeletons">
              <Skeleton style={{ height: 32, width: "100%" }} />
              <Skeleton style={{ height: 32, width: "100%" }} />
              <Skeleton style={{ height: 32, width: "100%" }} />
              <Skeleton style={{ height: 32, width: "100%" }} />
          </div>
        ) : rows.length ? (
          <div className="seller-vouchers__tableWrap">
              <table className="table table--tiki table--fixed seller-vouchers__table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Giá trị</th>
                    <th>Điều kiện</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th className="seller-vouchers__thRight"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td className="seller-vouchers__code">{v.code}</td>
                      <td>{renderValue(v)}</td>
                      <td>
                        <div className="seller-vouchers__condition">Tối thiểu: {formatVnd(v.minSubtotal || 0)}</div>
                        {v.minBuyerSpendMonth ? <div className="seller-vouchers__condition muted">KH cũ tháng: {formatVnd(v.minBuyerSpendMonth)}</div> : null}
                        {v.minBuyerSpendYear ? <div className="seller-vouchers__condition muted">KH cũ năm: {formatVnd(v.minBuyerSpendYear)}</div> : null}
                      </td>
                      <td>
                        <div className="seller-vouchers__condition">{v.startAt ? formatDateTime(v.startAt) : "—"}</div>
                        <div className="seller-vouchers__condition">{v.endAt ? formatDateTime(v.endAt) : "—"}</div>
                      </td>
                      <td>
                        {v.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Off</span>}
                        <div className="seller-vouchers__usage muted">
                          Used {v.usedCount || 0}{v.usageLimit ? `/${v.usageLimit}` : ""}
                        </div>
                      </td>
                      <td className="seller-vouchers__tdRight">
                        <div className="seller-vouchers__rowActions">
                          <button className="btn-secondary btn-sm" onClick={() => startEdit(v)} type="button">
                            Sửa
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => remove(v.id)} type="button">
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        ) : (
          <div className="seller-vouchers__empty muted">Chưa có voucher nào.</div>
        )}
      </div>

      <Modal
        open={openForm}
        title={isEditing ? "Cập nhật voucher" : "Tạo voucher"}
        onClose={closeForm}
        maxWidth="860px"
        footer={
          <div className="seller-vouchers__modalActions">
            <button className="btn-secondary btn-sm" onClick={closeForm} disabled={saving} type="button">
              Huỷ
            </button>
            <button className="btn-primary btn-sm" onClick={save} disabled={saving} type="button">
              {saving ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo voucher"}
            </button>
          </div>
        }
      >
        <div className="seller-vouchers__form">
          <div className="seller-vouchers__field">
            <div className="label">Mã voucher</div>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="VD: SHOP10K / GIAM10"
            />
            <div className="hint">Mã là duy nhất trên toàn hệ thống.</div>
          </div>

          <div className="seller-vouchers__grid2">
            <div className="seller-vouchers__field">
              <div className="label">Loại</div>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENT">Giảm %</option>
                <option value="FIXED">Giảm tiền</option>
              </select>
            </div>
            <div className="seller-vouchers__field">
              <div className="label">Giá trị</div>
              <input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
          </div>

          <div className="seller-vouchers__grid2">
            <div className="seller-vouchers__field">
              <div className="label">Đơn tối thiểu</div>
              <input className="input" type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </div>
            <div className="seller-vouchers__field">
              <div className="label">Giảm tối đa (nếu %)</div>
              <input
                className="input"
                type="number"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                placeholder="Bỏ trống = không giới hạn"
              />
            </div>
          </div>

          <div className="seller-vouchers__grid2">
            <div className="seller-vouchers__field">
              <div className="label">Điều kiện KH cũ (tháng)</div>
              <input className="input" type="number" value={form.minBuyerSpendMonth} onChange={(e) => setForm({ ...form, minBuyerSpendMonth: e.target.value })} />
            </div>
            <div className="seller-vouchers__field">
              <div className="label">Điều kiện KH cũ (năm)</div>
              <input className="input" type="number" value={form.minBuyerSpendYear} onChange={(e) => setForm({ ...form, minBuyerSpendYear: e.target.value })} />
            </div>
          </div>

          <div className="seller-vouchers__grid2">
            <div className="seller-vouchers__field">
              <div className="label">Bắt đầu</div>
              <input className="input" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div className="seller-vouchers__field">
              <div className="label">Kết thúc</div>
              <input className="input" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>

          <div className="seller-vouchers__grid2">
            <div className="seller-vouchers__field">
              <div className="label">Giới hạn lượt dùng</div>
              <input className="input" type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Bỏ trống = không giới hạn" />
            </div>
            <div className="seller-vouchers__field">
              <div className="label">Trạng thái</div>
              <label className="seller-vouchers__checkbox">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Kích hoạt
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
