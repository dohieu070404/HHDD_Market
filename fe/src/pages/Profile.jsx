import { useEffect, useMemo, useRef, useState } from "react";
import { customerApi } from "../api/customer";
import { authApi } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";
import { passwordStrength } from "../utils/passwordStrength";
import ImageCropModal from "../components/ImageCropModal";
import { uploadWithProgress } from "../utils/uploadWithProgress";
import { useToast } from "../contexts/ToastContext";
import "./Profile.css";

export default function Profile() {
  const { user, refreshMe } = useAuth();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: "" });
  const fileRef = useRef(null);
  const { push } = useToast();
  const [pendingFile, setPendingFile] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPct, setAvatarPct] = useState(0);
  const [avatarBuster, setAvatarBuster] = useState(0);
  const [pwd, setPwd] = useState({ oldPassword: "", newPassword: "", confirm: "" });

  const [newAddr, setNewAddr] = useState({ fullName: "", phone: "", line1: "", city: "", district: "", ward: "", postalCode: "", isDefault: false });
  const [editing, setEditing] = useState(null); // {id, form}

  const pwStrength = useMemo(() => passwordStrength(pwd.newPassword), [pwd.newPassword]);

  async function load() {
    setLoading(true);
    try {
      const [pRes, aRes] = await Promise.all([customerApi.getProfile(), customerApi.listAddresses()]);
      if (pRes?.success) {
        setProfile(pRes.data);
        setForm({
          name: pRes.data.name || "",
          phone: pRes.data.phone || "",
          avatarUrl: pRes.data.avatarUrl || "",
        });
      }
      if (aRes?.success) {
        setAddresses(aRes.data || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile() {
    setMessage(null);
    const res = await customerApi.updateProfile({
      name: form.name || undefined,
      phone: form.phone || undefined,
      avatarUrl: form.avatarUrl || undefined,
    });
    if (res?.success) {
      setMessage({ type: "success", text: "Đã cập nhật hồ sơ" });
      await refreshMe();
      await load();
    } else {
      setMessage({ type: "error", text: res?.message || "Cập nhật thất bại" });
    }
  }

  function onAvatarFileChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      push({ type: "error", title: "Không hợp lệ", message: "Vui lòng chọn ảnh (jpg/png/webp)." });
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      push({ type: "error", title: "Ảnh quá lớn", message: "Tối đa 4MB." });
      return;
    }
    setPendingFile(f);
    setCropOpen(true);
    // reset input so selecting same file again still triggers change
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadAvatarCropped(blob) {
    if (!blob) return;
    setAvatarUploading(true);
    setAvatarPct(0);
    try {
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      const res = await uploadWithProgress({
        path: "/customer/profile/avatar",
        formData: fd,
        onProgress: setAvatarPct,
      });
      if (res?.success) {
        setForm((s) => ({ ...s, avatarUrl: res.data?.avatarUrl || s.avatarUrl }));
        setAvatarBuster(Date.now());
        push({ type: "success", title: "Thành công", message: "Đã cập nhật ảnh đại diện" });
        await refreshMe();
        await load();
      } else {
        push({ type: "error", title: "Thất bại", message: res?.message || "Upload thất bại" });
      }
    } catch (e) {
      push({ type: "error", title: "Thất bại", message: e?.data?.message || "Upload thất bại" });
    } finally {
      setAvatarUploading(false);
      setAvatarPct(0);
      setPendingFile(null);
      setCropOpen(false);
    }
  }

  async function changePassword() {
    setMessage(null);
    if (!pwd.oldPassword || !pwd.newPassword) {
      setMessage({ type: "error", text: "Vui lòng nhập đầy đủ mật khẩu" });
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      setMessage({ type: "error", text: "Mật khẩu nhập lại không khớp" });
      return;
    }
    const res = await authApi.changePassword({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword });
    if (res?.success) {
      setPwd({ oldPassword: "", newPassword: "", confirm: "" });
      setMessage({ type: "success", text: "Đổi mật khẩu thành công" });
    } else {
      setMessage({ type: "error", text: res?.message || "Đổi mật khẩu thất bại" });
    }
  }

  async function addAddress() {
    setMessage(null);
    const res = await customerApi.createAddress(newAddr);
    if (res?.success) {
      setNewAddr({ fullName: "", phone: "", line1: "", city: "", district: "", ward: "", postalCode: "", isDefault: false });
      setMessage({ type: "success", text: "Đã thêm địa chỉ" });
      await load();
    } else {
      setMessage({ type: "error", text: res?.message || "Thêm địa chỉ thất bại" });
    }
  }

  async function setDefault(id) {
    const res = await customerApi.setDefaultAddress(id);
    if (res?.success) {
      await load();
    } else {
      setMessage({ type: "error", text: res?.message || "Không đặt được mặc định" });
    }
  }

  async function delAddress(id) {
    const res = await customerApi.deleteAddress(id);
    if (res?.success) {
      await load();
    } else {
      setMessage({ type: "error", text: res?.message || "Không xóa được" });
    }
  }

  async function startEdit(addr) {
    setEditing({ id: addr.id, form: { ...addr } });
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, form: f } = editing;
    const res = await customerApi.updateAddress(id, {
      fullName: f.fullName,
      phone: f.phone,
      line1: f.line1,
      city: f.city,
      district: f.district,
      ward: f.ward,
      postalCode: f.postalCode || undefined,
      isDefault: !!f.isDefault,
    });
    if (res?.success) {
      setEditing(null);
      await load();
    } else {
      setMessage({ type: "error", text: res?.message || "Cập nhật địa chỉ thất bại" });
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="container-page profile-page__container">
          <div className="card profile-page__message">Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="container-page profile-page__container">
        <div className="profile-page__header">
          <div className="profile-page__heading">
            <h1 className="profile-page__title">Hồ sơ</h1>
            <p className="muted profile-page__subtitle">Quản lý thông tin cá nhân và địa chỉ giao hàng.</p>
          </div>
          <div className="muted profile-page__email">{user?.email}</div>
        </div>

        {message ? (
          <div className={message.type === "error" ? "card profile-page__alert profile-page__alert--error" : "card profile-page__alert profile-page__alert--success"}>
            {message.text}
          </div>
        ) : null}

        <div className="profile-page__topGrid">
          <section className="card profile-section">
            <h2 className="profile-section__title">Thông tin cá nhân</h2>
            <div className="profile-section__form">
              <div>
                <div className="label">Tên hiển thị</div>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <div className="label">Số điện thoại</div>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <div className="label">Ảnh đại diện</div>
                <div className="profile-avatar">
                  <div className="profile-avatar__preview">
                    {form.avatarUrl ? (
                      <img
                        src={`${form.avatarUrl}${form.avatarUrl.includes("?") ? "&" : "?"}t=${avatarBuster || 0}`}
                        alt="avatar"
                      />
                    ) : null}
                  </div>

                  <div className="profile-avatar__controls">
                    <button type="button" className="link-strong" onClick={() => fileRef.current?.click()}>
                      Tải ảnh lên
                    </button>
                    <div className="hint">(JPG/PNG/WEBP, tối đa 4MB)</div>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarFileChange} />

                    {avatarUploading ? (
                      <div className="profile-avatar__upload">
                        <div className="progress"><div style={{ width: `${avatarPct}%` }} /></div>
                        <div className="muted profile-avatar__uploadText">Đang tải {avatarPct}%</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <details className="profile-avatar__alt">
                  <summary className="profile-avatar__altSummary">Hoặc dán Avatar URL</summary>
                  <div className="profile-avatar__altBody">
                    <input className="input" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
                    <div className="muted profile-avatar__altHint">Bạn có thể dán link ảnh (https://...)</div>
                  </div>
                </details>
              </div>
              <div className="profile-section__actions">
                <button className="btn-primary" onClick={saveProfile}>Lưu</button>
              </div>
            </div>
          </section>

          <section className="card profile-section">
            <h2 className="profile-section__title">Đổi mật khẩu</h2>
            <div className="profile-section__form">
              <div>
                <div className="label">Mật khẩu cũ</div>
                <input type="password" className="input" value={pwd.oldPassword} onChange={(e) => setPwd({ ...pwd, oldPassword: e.target.value })} />
              </div>
              <div>
                <div className="label">Mật khẩu mới</div>
                <input type="password" className="input" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
                <div className="profile-strength">
                  <div className="profile-strength__row">
                    <div className="muted profile-strength__text">
                      Độ mạnh: <span className="profile-strength__label">{pwStrength.label}</span>
                    </div>
                    <div className="muted profile-strength__hint">Gợi ý: 8+ ký tự, chữ hoa/thường, số, ký tự đặc biệt</div>
                  </div>
                  <div className="profile-strength__bar" aria-hidden>
                    <div className="profile-strength__barFill" style={{ width: `${(pwStrength.score / 4) * 100}%` }} />
                  </div>
                </div>
              </div>
              <div>
                <div className="label">Nhập lại</div>
                <input type="password" className="input" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={changePassword}>Đổi mật khẩu</button>
            </div>
          </section>
        </div>

        <div className="card profile-addresses">
          <h2 className="profile-addresses__title">Địa chỉ giao hàng</h2>

          <div className="profile-addresses__grid">
            <div className="profile-addresses__list">
              {addresses.length ? (
                addresses.map((a) => (
                  <div key={a.id} className="card profile-address">
                    <div className="profile-address__head">
                      <div>
                        <div className="profile-address__name">
                          {a.fullName} <span className="muted">({a.phone})</span>
                          {a.isDefault ? <span className="profile-address__badge">Mặc định</span> : null}
                        </div>
                        <div className="muted profile-address__line">{a.line1}, {a.ward}, {a.district}, {a.city}</div>
                      </div>
                      <div className="profile-address__actions">
                        <button className="btn-ghost" onClick={() => startEdit(a)}>Sửa</button>
                        <button className="btn-ghost btn-ghost--danger" onClick={() => delAddress(a.id)}>Xóa</button>
                      </div>
                    </div>
                    {!a.isDefault ? (
                      <button className="btn-secondary profile-address__defaultBtn" onClick={() => setDefault(a.id)}>Đặt mặc định</button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="muted profile-addresses__empty">Chưa có địa chỉ.</div>
              )}
            </div>

            <div className="profile-addresses__side">
              <div className="card profile-addressForm profile-addressForm--new">
                <div className="profile-addressForm__title">Thêm địa chỉ mới</div>
                <div className="profile-addressForm__fields">
                  <div>
                    <div className="label">Họ và tên</div>
                    <input className="input" value={newAddr.fullName} onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })} />
                  </div>
                  <div>
                    <div className="label">SĐT</div>
                    <input className="input" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} />
                  </div>
                  <div className="profile-addressForm__field profile-addressForm__field--wide">
                    <div className="label">Địa chỉ</div>
                    <input className="input" value={newAddr.line1} onChange={(e) => setNewAddr({ ...newAddr, line1: e.target.value })} />
                  </div>
                  <div>
                    <div className="label">Thành phố</div>
                    <input className="input" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                  </div>
                  <div>
                    <div className="label">Quận/Huyện</div>
                    <input className="input" value={newAddr.district} onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })} />
                  </div>
                  <div>
                    <div className="label">Phường/Xã</div>
                    <input className="input" value={newAddr.ward} onChange={(e) => setNewAddr({ ...newAddr, ward: e.target.value })} />
                  </div>
                  <div>
                    <div className="label">Mã bưu điện</div>
                    <input className="input" value={newAddr.postalCode} onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value })} />
                  </div>
                  <label className="profile-addressForm__check">
                    <input type="checkbox" checked={newAddr.isDefault} onChange={(e) => setNewAddr({ ...newAddr, isDefault: e.target.checked })} />
                    Đặt làm mặc định
                  </label>
                </div>
                <button className="btn-primary profile-addressForm__submit" onClick={addAddress}>Thêm địa chỉ</button>
              </div>

              {editing ? (
                <div className="card profile-addressForm profile-addressForm--edit">
                  <div className="profile-addressForm__title">Sửa địa chỉ</div>
                  <div className="profile-addressForm__fields">
                    <div>
                      <div className="label">Họ và tên</div>
                      <input className="input" value={editing.form.fullName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, fullName: e.target.value } })} />
                    </div>
                    <div>
                      <div className="label">SĐT</div>
                      <input className="input" value={editing.form.phone} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, phone: e.target.value } })} />
                    </div>
                    <div className="profile-addressForm__field profile-addressForm__field--wide">
                      <div className="label">Địa chỉ</div>
                      <input className="input" value={editing.form.line1} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, line1: e.target.value } })} />
                    </div>
                    <div>
                      <div className="label">Thành phố</div>
                      <input className="input" value={editing.form.city} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, city: e.target.value } })} />
                    </div>
                    <div>
                      <div className="label">Quận/Huyện</div>
                      <input className="input" value={editing.form.district} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, district: e.target.value } })} />
                    </div>
                    <div>
                      <div className="label">Phường/Xã</div>
                      <input className="input" value={editing.form.ward} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, ward: e.target.value } })} />
                    </div>
                    <div>
                      <div className="label">Mã bưu điện</div>
                      <input className="input" value={editing.form.postalCode || ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, postalCode: e.target.value } })} />
                    </div>
                    <label className="profile-addressForm__check">
                      <input type="checkbox" checked={!!editing.form.isDefault} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isDefault: e.target.checked } })} />
                      Đặt làm mặc định
                    </label>
                  </div>

                  <div className="profile-addressForm__actions">
                    <button className="btn-primary" onClick={saveEdit}>Lưu</button>
                    <button className="btn-secondary" onClick={() => setEditing(null)}>Hủy</button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <ImageCropModal
          open={cropOpen}
          file={pendingFile}
          title="Cắt ảnh đại diện"
          aspect={1}
          onClose={() => {
            setCropOpen(false);
            setPendingFile(null);
          }}
          onDone={uploadAvatarCropped}
        />
      </div>
    </div>
  );
}
