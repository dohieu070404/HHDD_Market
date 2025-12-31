import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";
import Skeleton from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import { formatDateTime, formatVnd } from "../../utils/format";

import "./AdminVouchers.css";

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

export default function AdminVouchers() {
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
      const res = await adminApi.listVouchers();
      if (res?.success) setRows(res.data || []);
      else setError(res?.message || "Không tải được voucher sàn");
    } catch (e) {
      setError(e?.message || "Không tải được voucher sàn");
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
      if (isEditing) res = await adminApi.updateVoucher(editingId, payload);
      else res = await adminApi.createVoucher(payload);

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

  async function deactivate(id) {
    if (!confirm("Tắt voucher này? (Hệ thống sẽ set isActive=false)")) return;
    try {
      const res = await adminApi.deleteVoucher(id);
      if (!res?.success) throw new Error(res?.message || "Không tắt được voucher");
      await fetchList();
    } catch (e) {
      setError(e?.message || "Không tắt được voucher");
    }
  }

  function renderValue(v) {
    return v.type === "PERCENT" ? `${v.value}%` : formatVnd(v.value);
  }

  return (
    <section className="admin-vouchers">
      <div className="admin-vouchers__header">
        <div>
          <h1 className="admin-vouchers__title">Voucher sàn</h1>
          <p className="muted admin-vouchers__subtitle">
            Tạo mã giảm giá cho toàn sàn và áp dụng trong Checkout (có điều kiện khách hàng cũ).
          </p>
        </div>
        <div className="admin-vouchers__headerActions">
          <button className="btn-primary" onClick={openCreate} type="button">
            + Tạo voucher
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchList} type="button">
            Reload
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--danger admin-vouchers__alert">{error}</div> : null}

      <div className="card admin-vouchers__listCard">
        <div className="admin-vouchers__listHead">
          <div className="admin-vouchers__cardTitle">Danh sách voucher sàn</div>
          <button className="btn btn-ghost btn-sm" onClick={fetchList} type="button">
            Reload
          </button>
        </div>

          {loading ? (
            <div className="admin-vouchers__skeleton">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} style={{ height: 32, width: "100%" }} />
              ))}
            </div>
          ) : rows.length ? (
            <div className="admin-vouchers__tableWrap">
              <table className="table table--tiki table--fixed admin-vouchers__table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Giá trị</th>
                    <th>Điều kiện</th>
                    <th>Hiệu lực</th>
                    <th>Trạng thái</th>
                    <th className="admin-vouchers__thRight"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id}>
                      <td className="admin-vouchers__code">{v.code}</td>
                      <td>{renderValue(v)}</td>
                      <td className="admin-vouchers__conditions">
                        <div>Tối thiểu: {formatVnd(v.minSubtotal || 0)}</div>
                        {v.minBuyerSpendMonth ? <div className="muted">KH cũ tháng: {formatVnd(v.minBuyerSpendMonth)}</div> : null}
                        {v.minBuyerSpendYear ? <div className="muted">KH cũ năm: {formatVnd(v.minBuyerSpendYear)}</div> : null}
                      </td>
                      <td className="admin-vouchers__validity">
                        <div>{v.startAt ? formatDateTime(v.startAt) : "—"}</div>
                        <div>{v.endAt ? formatDateTime(v.endAt) : "—"}</div>
                      </td>
                      <td>
                        {v.isActive ? <span className="badge badge--success">Active</span> : <span className="badge badge--gray">Off</span>}
                        <div className="muted admin-vouchers__used">
                          Used {v.usedCount || 0}
                          {v.usageLimit ? `/${v.usageLimit}` : ""}
                        </div>
                      </td>
                      <td className="admin-vouchers__tdRight">
                        <div className="admin-vouchers__rowActions">
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
              <div className="muted admin-vouchers__footNote">
                “Tắt” voucher sẽ set <b>isActive=false</b> (không xoá record) để tránh mất lịch sử đối soát.
              </div>
            </div>
          ) : (
            <div className="muted admin-vouchers__empty">Chưa có voucher nào.</div>
          )}
      </div>

      <Modal
        open={openForm}
        title={isEditing ? "Cập nhật voucher sàn" : "Tạo voucher sàn"}
        onClose={closeForm}
        maxWidth="860px"
        footer={
          <div className="admin-vouchers__modalActions">
            <button className="btn-secondary btn-sm" onClick={closeForm} disabled={saving} type="button">
              Huỷ
            </button>
            <button className="btn-primary btn-sm" onClick={save} disabled={saving} type="button">
              {saving ? "Đang lưu..." : isEditing ? "Cập nhật" : "Tạo voucher"}
            </button>
          </div>
        }
      >
        <div className="admin-vouchers__form">
          <div className="field">
            <div className="label">Mã voucher</div>
            <input
              className="input"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="VD: SAN10 / NEWUSER"
            />
          </div>

          <div className="admin-vouchers__grid2">
            <div className="field">
              <div className="label">Loại</div>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENT">Giảm %</option>
                <option value="FIXED">Giảm tiền</option>
              </select>
            </div>
            <div className="field">
              <div className="label">Giá trị</div>
              <input className="input" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
          </div>

          <div className="admin-vouchers__grid2">
            <div className="field">
              <div className="label">Đơn tối thiểu</div>
              <input className="input" type="number" value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
            </div>
            <div className="field">
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

          <div className="admin-vouchers__grid2">
            <div className="field">
              <div className="label">Điều kiện KH cũ (tháng)</div>
              <input className="input" type="number" value={form.minBuyerSpendMonth} onChange={(e) => setForm({ ...form, minBuyerSpendMonth: e.target.value })} />
            </div>
            <div className="field">
              <div className="label">Điều kiện KH cũ (năm)</div>
              <input className="input" type="number" value={form.minBuyerSpendYear} onChange={(e) => setForm({ ...form, minBuyerSpendYear: e.target.value })} />
            </div>
          </div>

          <div className="admin-vouchers__grid2">
            <div className="field">
              <div className="label">Bắt đầu</div>
              <input className="input" type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div className="field">
              <div className="label">Kết thúc</div>
              <input className="input" type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
          </div>

          <div className="admin-vouchers__grid2">
            <div className="field">
              <div className="label">Giới hạn lượt dùng</div>
              <input className="input" type="number" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} placeholder="Bỏ trống = không giới hạn" />
            </div>
            <div className="admin-vouchers__checkRow">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span className="admin-vouchers__checkLabel">Kích hoạt</span>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}
