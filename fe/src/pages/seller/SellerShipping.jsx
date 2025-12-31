import { useEffect, useMemo, useState } from "react";
import { sellerApi } from "../../api/seller";
import Skeleton from "../../components/ui/Skeleton";
import { formatVnd } from "../../utils/format";

import "./SellerShipping.css";

function ShippingModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className="modal seller-shipping__modal">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Đóng
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <div className="label">{label}</div>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </label>
  );
}

export default function SellerShipping() {
  const [tab, setTab] = useState("methods");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addresses, setAddresses] = useState([]);
  const [methods, setMethods] = useState([]);

  const [openAddrModal, setOpenAddrModal] = useState(false);
  const [editingAddr, setEditingAddr] = useState(null);

  const [openMethodModal, setOpenMethodModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);

  const emptyAddresses = useMemo(() => !addresses || addresses.length === 0, [addresses]);
  const emptyMethods = useMemo(() => !methods || methods.length === 0, [methods]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [addrRes, cfgRes] = await Promise.all([sellerApi.listShopAddresses(), sellerApi.listShippingConfigs()]);
      setAddresses(addrRes?.success ? addrRes.data || [] : []);
      setMethods(cfgRes?.success ? cfgRes.data || [] : []);
    } catch (e) {
      setError(e?.message || "Không thể tải cấu hình vận chuyển");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const addrFormDefault = {
    type: "PICKUP",
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    ward: "",
    district: "",
    city: "",
    province: "",
    country: "VN",
    postalCode: "",
  };

  const methodFormDefault = {
    serviceName: "",
    description: "",
    isActive: true,
    baseFee: 20000,
    freeShippingOver: "",
    minDays: 2,
    maxDays: 4,
  };

  const [addrForm, setAddrForm] = useState(addrFormDefault);
  const [methodForm, setMethodForm] = useState(methodFormDefault);

  // ===== Address handlers =====
  function openCreateAddr() {
    setEditingAddr(null);
    setAddrForm(addrFormDefault);
    setOpenAddrModal(true);
  }

  function openEditAddr(addr) {
    setEditingAddr(addr);
    setAddrForm({ ...addrFormDefault, ...addr });
    setOpenAddrModal(true);
  }

  async function submitAddr() {
    try {
      // payload địa chỉ
      const payload = {
        type: addrForm.type,
        fullName: String(addrForm.fullName || "").trim(),
        phone: String(addrForm.phone || "").trim(),
        line1: String(addrForm.line1 || "").trim(),
        line2: addrForm.line2 ? String(addrForm.line2).trim() : "",
        ward: addrForm.ward ? String(addrForm.ward).trim() : "",
        district: addrForm.district ? String(addrForm.district).trim() : "",
        city: addrForm.city ? String(addrForm.city).trim() : "",
        province: addrForm.province ? String(addrForm.province).trim() : "",
        country: String(addrForm.country || "VN").trim(),
        postalCode: addrForm.postalCode ? String(addrForm.postalCode).trim() : "",
      };

      if (!payload.fullName) throw new Error("Vui lòng nhập tên người nhận");
      if (!payload.phone) throw new Error("Vui lòng nhập số điện thoại");
      if (!payload.line1) throw new Error("Vui lòng nhập địa chỉ (line1)");

      // ⚠️ chỉnh lại tên hàm theo sellerApi của bạn
      const createFn =
        sellerApi.createShopAddress ||
        sellerApi.createAddress ||
        sellerApi.createSellerAddress;

      const updateFn =
        sellerApi.updateShopAddress ||
        sellerApi.updateAddress ||
        sellerApi.updateSellerAddress;

      if (editingAddr) {
        if (!updateFn) throw new Error("Chưa có API update address trong sellerApi");
        await updateFn(editingAddr.id, payload);
      } else {
        if (!createFn) throw new Error("Chưa có API create address trong sellerApi");
        await createFn(payload);
      }

      setOpenAddrModal(false);
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể lưu địa chỉ");
    }
  }

  async function removeAddr(a) {
    if (!confirm("Xoá địa chỉ này?")) return;
    try {
      // ⚠️ chỉnh lại tên hàm theo sellerApi của bạn
      const deleteFn =
        sellerApi.deleteShopAddress ||
        sellerApi.deleteAddress ||
        sellerApi.removeShopAddress;

      if (!deleteFn) throw new Error("Chưa có API delete address trong sellerApi");
      await deleteFn(a.id);

      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể xoá địa chỉ");
    }
  }

  // ===== Method handlers =====
  function openCreateMethod() {
    setEditingMethod(null);
    setMethodForm(methodFormDefault);
    setOpenMethodModal(true);
  }

  function openEditMethod(m) {
    setEditingMethod(m);
    setMethodForm({ ...methodFormDefault, ...m });
    setOpenMethodModal(true);
  }

  async function submitMethod() {
    try {
      const payload = {
        serviceName: String(methodForm.serviceName || "").trim(),
        description: methodForm.description ? String(methodForm.description).trim() : null,
        isActive: !!methodForm.isActive,
        baseFee: Number(methodForm.baseFee || 0),
        freeShippingOver: methodForm.freeShippingOver === "" ? null : Number(methodForm.freeShippingOver),
        minDays: Number(methodForm.minDays || 2),
        maxDays: Number(methodForm.maxDays || 4),
      };

      if (!payload.serviceName) throw new Error("Vui lòng nhập tên dịch vụ");
      if (payload.minDays > payload.maxDays) throw new Error("ETA min không được lớn hơn ETA max");

      if (editingMethod) {
        await sellerApi.updateShippingConfig(editingMethod.id, payload);
      } else {
        await sellerApi.createShippingConfig(payload);
      }

      setOpenMethodModal(false);
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể lưu phương thức vận chuyển");
    }
  }

  // async function removeMethod(m) {
  //   if (!confirm("Xoá phương thức vận chuyển này?")) return;
  //   try {
  //     await sellerApi.deleteShippingConfig(m.id);
  //     await loadAll();
  //   } catch (e) {
  //     alert(e?.message || "Không thể xoá");
  //   }
  // }
  async function removeMethod(m) {
    if (!confirm("Xoá phương thức vận chuyển này?")) return;
    try {
      const res = await sellerApi.deleteShippingConfig(m.id);
      if (!res?.success) throw new Error(res?.message || "Không thể xoá");
      await loadAll();
    } catch (e) {
      alert(e?.message || "Không thể xoá");
    }
  }

  return (
    <section className="seller-shipping">
      <header className="seller-shipping__header">
        <div>
          <h1 className="seller-shipping__title">Vận chuyển</h1>
          <p className="seller-shipping__subtitle muted">
            Thiết lập địa chỉ lấy hàng/hoàn hàng và phương thức vận chuyển cho shop.
          </p>
        </div>
        <div className="seller-shipping__headerActions">
          {tab === "addresses" ? (
            <button className="btn-primary" onClick={openCreateAddr} type="button">
              + Thêm địa chỉ
            </button>
          ) : (
            <button className="btn-primary" onClick={openCreateMethod} type="button">
              + Thêm phương thức
            </button>
          )}
        </div>
      </header>

      <div className="seller-shipping__tabs" role="tablist" aria-label="Shipping tabs">
        <div className="segmented">
          <button
            className={`segmented__btn ${tab === "methods" ? "is-active" : ""}`}
            onClick={() => setTab("methods")}
            type="button"
          >
            Phương thức
          </button>
          <button
            className={`segmented__btn ${tab === "addresses" ? "is-active" : ""}`}
            onClick={() => setTab("addresses")}
            type="button"
          >
            Địa chỉ
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--danger seller-shipping__alert">{error}</div> : null}

      {loading ? (
        <div className="seller-shipping__skeletons">
          <Skeleton style={{ height: 112 }} />
          <Skeleton style={{ height: 112 }} />
        </div>
      ) : tab === "addresses" ? (
        <div className="card seller-shipping__card">
          <div className="seller-shipping__cardHead">
            <div className="seller-shipping__cardTitle">Địa chỉ shop</div>
            <button className="btn btn-ghost" onClick={loadAll} type="button">
              Làm mới
            </button>
          </div>

          {emptyAddresses ? (
            <div className="seller-shipping__emptyBox">
              Chưa có địa chỉ. Hãy thêm <b>địa chỉ lấy hàng</b> để dùng cho vận chuyển/label sau này.
            </div>
          ) : (
            <div className="seller-shipping__tableWrap">
              <table className="table table--tiki table--fixed seller-shipping__table seller-shipping__table--addresses">
                <thead>
                  <tr>
                    <th scope="col">Loại</th>
                    <th scope="col">Người nhận</th>
                    <th scope="col">Địa chỉ</th>
                    <th scope="col">Thành phố</th>
                    <th scope="col" className="seller-shipping__thRight"></th>
                  </tr>
                </thead>
                <tbody>
                  {addresses.map((a) => (
                    <tr key={a.id}>
                      <td>{a.type}</td>
                      <td>
                        <div className="seller-shipping__strong">{a.fullName || "-"}</div>
                        <div className="seller-shipping__muted">{a.phone || ""}</div>
                      </td>
                      <td>
                        <div className="seller-shipping__strong">{a.line1}</div>
                        <div className="seller-shipping__muted">{a.line2 || ""}</div>
                      </td>
                      <td>{a.city || a.province || "-"}</td>
                      <td className="seller-shipping__tdRight">
                        <div className="seller-shipping__rowActions">
                          <button className="btn-secondary btn-sm" onClick={() => openEditAddr(a)} type="button">
                            Sửa
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => removeAddr(a)} type="button">
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card seller-shipping__card">
          <div className="seller-shipping__cardHead">
            <div className="seller-shipping__cardTitle">Phương thức vận chuyển</div>
            <button className="btn btn-ghost" onClick={loadAll} type="button">
              Làm mới
            </button>
          </div>

          {emptyMethods ? (
            <div className="seller-shipping__emptyBox">
              Chưa có phương thức nào. Hãy thêm ít nhất 1 phương thức để Checkout có thể quote phí ship.
            </div>
          ) : (
            <div className="seller-shipping__tableWrap">
              <table className="table table--tiki table--fixed seller-shipping__table seller-shipping__table--methods">
                <thead>
                  <tr>
                    <th scope="col">Dịch vụ</th>
                    <th scope="col">Phí vận chuyển</th>
                    <th scope="col">ETA</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col" className="seller-shipping__thRight"></th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="seller-shipping__strong">{m.serviceName}</div>
                        <div className="seller-shipping__muted">{m.description || ""}</div>
                      </td>
                      <td>
                        <div className="seller-shipping__strong">{formatVnd(m.baseFee || 0)}</div>
                        <div className="seller-shipping__muted">
                          {m.freeShippingOver != null ? `Miễn phí từ ${formatVnd(m.freeShippingOver)}` : "Phí cố định"}
                        </div>
                      </td>
                      <td>
                        {m.minDays}-{m.maxDays} ngày
                      </td>
                      <td>
                        <span className={"badge " + (m.isActive ? "badge-success" : "badge-muted")}>
                          {m.isActive ? "Đang bật" : "Tắt"}
                        </span>
                      </td>
                      <td className="seller-shipping__tdRight">
                        <div className="seller-shipping__rowActions">
                          <button className="btn-secondary btn-sm" onClick={() => openEditMethod(m)} type="button">
                            Sửa
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => removeMethod(m)} type="button">
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ShippingModal
        open={openAddrModal}
        title={editingAddr ? "Sửa địa chỉ" : "Thêm địa chỉ"}
        onClose={() => setOpenAddrModal(false)}
        footer={
          <div className="seller-shipping__modalActions">
            <button className="btn-secondary" onClick={() => setOpenAddrModal(false)} type="button">
              Huỷ
            </button>
            <button className="btn-primary" onClick={submitAddr} type="button">
              Lưu
            </button>
          </div>
        }
      >
        <div className="seller-shipping__form">
          <div className="seller-shipping__grid2">
            <Field label="Loại">
              <select
                className="input"
                value={addrForm.type}
                onChange={(e) => setAddrForm((s) => ({ ...s, type: e.target.value }))}
              >
                <option value="PICKUP">PICKUP (Lấy hàng)</option>
                <option value="RETURN">RETURN (Hoàn hàng)</option>
              </select>
            </Field>
            <Field label="Số điện thoại">
              <input
                className="input"
                value={addrForm.phone}
                onChange={(e) => setAddrForm((s) => ({ ...s, phone: e.target.value }))}
              />
            </Field>
          </div>

          <div className="seller-shipping__grid2">
            <Field label="Tên người nhận">
              <input
                className="input"
                value={addrForm.fullName}
                onChange={(e) => setAddrForm((s) => ({ ...s, fullName: e.target.value }))}
              />
            </Field>
            <Field label="Quốc gia">
              <input
                className="input"
                value={addrForm.country}
                onChange={(e) => setAddrForm((s) => ({ ...s, country: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Địa chỉ (line1)" hint="Ví dụ: 123 Lê Lợi">
            <input
              className="input"
              value={addrForm.line1}
              onChange={(e) => setAddrForm((s) => ({ ...s, line1: e.target.value }))}
            />
          </Field>
          <Field label="Địa chỉ (line2)">
            <input
              className="input"
              value={addrForm.line2}
              onChange={(e) => setAddrForm((s) => ({ ...s, line2: e.target.value }))}
            />
          </Field>

          <div className="seller-shipping__grid2">
            <Field label="Phường/Xã">
              <input
                className="input"
                value={addrForm.ward}
                onChange={(e) => setAddrForm((s) => ({ ...s, ward: e.target.value }))}
              />
            </Field>
            <Field label="Quận/Huyện">
              <input
                className="input"
                value={addrForm.district}
                onChange={(e) => setAddrForm((s) => ({ ...s, district: e.target.value }))}
              />
            </Field>
          </div>

          <div className="seller-shipping__grid2">
            <Field label="Thành phố">
              <input
                className="input"
                value={addrForm.city}
                onChange={(e) => setAddrForm((s) => ({ ...s, city: e.target.value }))}
              />
            </Field>
            <Field label="Tỉnh">
              <input
                className="input"
                value={addrForm.province}
                onChange={(e) => setAddrForm((s) => ({ ...s, province: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </ShippingModal>

      <ShippingModal
        open={openMethodModal}
        title={editingMethod ? "Sửa phương thức" : "Thêm phương thức"}
        onClose={() => setOpenMethodModal(false)}
        footer={
          <div className="seller-shipping__modalActions">
            <button className="btn-secondary" onClick={() => setOpenMethodModal(false)} type="button">
              Huỷ
            </button>
            <button className="btn-primary" onClick={submitMethod} type="button">
              Lưu
            </button>
          </div>
        }
      >
        <div className="seller-shipping__form">
          <div className="muted">
            Phí vận chuyển hiện đang tính theo <b>phí cố định</b> cho mỗi đơn của shop (không còn tính theo /sp hay /kg).
          </div>

          <Field label="Tên dịch vụ">
            <input
              className="input"
              value={methodForm.serviceName}
              onChange={(e) => setMethodForm((s) => ({ ...s, serviceName: e.target.value }))}
            />
          </Field>
          <Field label="Mô tả (tuỳ chọn)" hint="Hiển thị cho khách ở bước thanh toán (VD: Giao tiêu chuẩn 2–4 ngày)">
            <input
              className="input"
              value={methodForm.description}
              onChange={(e) => setMethodForm((s) => ({ ...s, description: e.target.value }))}
            />
          </Field>

          <div className="seller-shipping__grid2">
            <Field label="Phí vận chuyển (cố định)">
              <input
                type="number"
                className="input"
                value={methodForm.baseFee}
                onChange={(e) => setMethodForm((s) => ({ ...s, baseFee: e.target.value }))}
              />
            </Field>
            <Field label="Miễn phí vận chuyển từ" hint="Để trống nếu không áp dụng">
              <input
                type="number"
                className="input"
                value={methodForm.freeShippingOver}
                onChange={(e) => setMethodForm((s) => ({ ...s, freeShippingOver: e.target.value }))}
              />
            </Field>
          </div>

          <div className="seller-shipping__grid2">
            <Field label="Thời gian giao min (ngày)">
              <input
                type="number"
                className="input"
                value={methodForm.minDays}
                onChange={(e) => setMethodForm((s) => ({ ...s, minDays: e.target.value }))}
              />
            </Field>
            <Field label="Thời gian giao max (ngày)">
              <input
                type="number"
                className="input"
                value={methodForm.maxDays}
                onChange={(e) => setMethodForm((s) => ({ ...s, maxDays: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Trạng thái">
            <div className="seller-shipping__checkboxRow">
              <label className="seller-shipping__checkbox">
                <input
                  type="checkbox"
                  checked={!!methodForm.isActive}
                  onChange={(e) => setMethodForm((s) => ({ ...s, isActive: e.target.checked }))}
                />
                Bật
              </label>
            </div>
          </Field>
        </div>
      </ShippingModal>
    </section>
  );
}
