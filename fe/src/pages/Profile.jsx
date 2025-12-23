import { useEffect, useMemo, useState } from "react";
import { customerApi } from "../api/customer";
import { authApi } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";
import { passwordStrength } from "../utils/passwordStrength";

export default function Profile() {
  const { user, refreshMe } = useAuth();
  const [profile, setProfile] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "", avatarUrl: "" });
  const [pwd, setPwd] = useState({ oldPassword: "", newPassword: "", confirm: "" });

  const [newAddr, setNewAddr] = useState({ fullName: "", phone: "", addressLine1: "", city: "", district: "", ward: "", postalCode: "", isDefault: false });
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
      setNewAddr({ fullName: "", phone: "", addressLine1: "", city: "", district: "", ward: "", postalCode: "", isDefault: false });
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
      addressLine1: f.addressLine1,
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
      <div className="container-page py-10">
        <div className="card p-6">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hồ sơ</h1>
          <p className="muted text-sm">Quản lý thông tin cá nhân và địa chỉ giao hàng.</p>
        </div>
        <div className="text-sm muted">{user?.email}</div>
      </div>

      {message ? (
        <div className={"mt-4 card p-4 " + (message.type === "error" ? "text-red-700 bg-red-50 border-red-100" : "text-emerald-800 bg-emerald-50 border-emerald-100")}>{message.text}</div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-sm font-semibold">Thông tin cá nhân</h2>
          <div className="mt-4 grid gap-3">
            <div>
              <div className="label mb-1">Tên hiển thị</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <div className="label mb-1">Số điện thoại</div>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <div className="label mb-1">Avatar URL</div>
              <input className="input" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
              <div className="muted text-xs mt-1">Bạn có thể dán link ảnh (https://...)</div>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={saveProfile}>Lưu</button>
              {form.avatarUrl ? (
                <img src={form.avatarUrl} alt="avatar" className="h-10 w-10 rounded-full object-cover border border-slate-200" />
              ) : null}
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-sm font-semibold">Đổi mật khẩu</h2>
          <div className="mt-4 grid gap-3">
            <div>
              <div className="label mb-1">Mật khẩu cũ</div>
              <input type="password" className="input" value={pwd.oldPassword} onChange={(e) => setPwd({ ...pwd, oldPassword: e.target.value })} />
            </div>
            <div>
              <div className="label mb-1">Mật khẩu mới</div>
              <input type="password" className="input" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="muted">Độ mạnh: <span className="font-medium text-slate-900">{pwStrength.label}</span></div>
                <div className="muted">Gợi ý: 8+ ký tự, chữ hoa/thường, số, ký tự đặc biệt</div>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-slate-800" style={{ width: `${(pwStrength.score / 4) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="label mb-1">Nhập lại</div>
              <input type="password" className="input" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={changePassword}>Đổi mật khẩu</button>
          </div>
        </section>
      </div>

      <div className="mt-6 card p-6">
        <h2 className="text-sm font-semibold">Địa chỉ giao hàng</h2>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {addresses.length ? (
              addresses.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {a.fullName} <span className="muted">({a.phone})</span>
                        {a.isDefault ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">Mặc định</span> : null}
                      </div>
                      <div className="muted text-sm">{a.addressLine1}, {a.ward}, {a.district}, {a.city}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost" onClick={() => startEdit(a)}>Sửa</button>
                      <button className="btn-ghost text-red-600" onClick={() => delAddress(a.id)}>Xóa</button>
                    </div>
                  </div>
                  {!a.isDefault ? (
                    <button className="btn-secondary mt-3" onClick={() => setDefault(a.id)}>Đặt mặc định</button>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="muted text-sm">Chưa có địa chỉ.</div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium">Thêm địa chỉ mới</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="label mb-1">Họ và tên</div>
                  <input className="input" value={newAddr.fullName} onChange={(e) => setNewAddr({ ...newAddr, fullName: e.target.value })} />
                </div>
                <div>
                  <div className="label mb-1">SĐT</div>
                  <input className="input" value={newAddr.phone} onChange={(e) => setNewAddr({ ...newAddr, phone: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <div className="label mb-1">Địa chỉ</div>
                  <input className="input" value={newAddr.addressLine1} onChange={(e) => setNewAddr({ ...newAddr, addressLine1: e.target.value })} />
                </div>
                <div>
                  <div className="label mb-1">Thành phố</div>
                  <input className="input" value={newAddr.city} onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })} />
                </div>
                <div>
                  <div className="label mb-1">Quận/Huyện</div>
                  <input className="input" value={newAddr.district} onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })} />
                </div>
                <div>
                  <div className="label mb-1">Phường/Xã</div>
                  <input className="input" value={newAddr.ward} onChange={(e) => setNewAddr({ ...newAddr, ward: e.target.value })} />
                </div>
                <div>
                  <div className="label mb-1">Mã bưu điện</div>
                  <input className="input" value={newAddr.postalCode} onChange={(e) => setNewAddr({ ...newAddr, postalCode: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newAddr.isDefault} onChange={(e) => setNewAddr({ ...newAddr, isDefault: e.target.checked })} />
                  Đặt làm mặc định
                </label>
              </div>
              <button className="btn-primary mt-4" onClick={addAddress}>Thêm địa chỉ</button>
            </div>

            {editing ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-medium">Sửa địa chỉ</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="label mb-1">Họ và tên</div>
                    <input className="input" value={editing.form.fullName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, fullName: e.target.value } })} />
                  </div>
                  <div>
                    <div className="label mb-1">SĐT</div>
                    <input className="input" value={editing.form.phone} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, phone: e.target.value } })} />
                  </div>
                  <div className="md:col-span-2">
                    <div className="label mb-1">Địa chỉ</div>
                    <input className="input" value={editing.form.addressLine1} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, addressLine1: e.target.value } })} />
                  </div>
                  <div>
                    <div className="label mb-1">Thành phố</div>
                    <input className="input" value={editing.form.city} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, city: e.target.value } })} />
                  </div>
                  <div>
                    <div className="label mb-1">Quận/Huyện</div>
                    <input className="input" value={editing.form.district} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, district: e.target.value } })} />
                  </div>
                  <div>
                    <div className="label mb-1">Phường/Xã</div>
                    <input className="input" value={editing.form.ward} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, ward: e.target.value } })} />
                  </div>
                  <div>
                    <div className="label mb-1">Mã bưu điện</div>
                    <input className="input" value={editing.form.postalCode || ""} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, postalCode: e.target.value } })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editing.form.isDefault} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isDefault: e.target.checked } })} />
                    Đặt làm mặc định
                  </label>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button className="btn-primary" onClick={saveEdit}>Lưu</button>
                  <button className="btn-secondary" onClick={() => setEditing(null)}>Hủy</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
