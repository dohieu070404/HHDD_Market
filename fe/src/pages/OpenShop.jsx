import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

function StatusPill({ status }) {
  const map = {
    PENDING: "Đang chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Bị từ chối",
  };
  const label = map[status] || status;
  const cls = status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function OpenShop() {
  const { user, refreshMe } = useAuth();
  const [form, setForm] = useState({ shopName: "", phone: "", taxId: "", kycDocumentUrl: "" });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const existingProfile = user?.sellerProfile || null;
  const shop = user?.shop || null;

  const canApply = useMemo(() => {
    if (!user) return false;
    if (user.role === "SELLER") return false;
    if (existingProfile) return false;
    return true;
  }, [user, existingProfile]);

  async function submit() {
    setMsg(null);
    if (!form.shopName || form.shopName.trim().length < 3) {
      setMsg({ type: "error", text: "Tên shop tối thiểu 3 ký tự" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.applySeller({
        shopName: form.shopName.trim(),
        phone: form.phone?.trim() || undefined,
        taxId: form.taxId?.trim() || undefined,
        kycDocumentUrl: form.kycDocumentUrl?.trim() || undefined,
      });
      if (res?.success) {
        setMsg({ type: "success", text: "Đã gửi yêu cầu mở shop. Vui lòng chờ Admin duyệt." });
        await refreshMe();
      } else {
        setMsg({ type: "error", text: res?.message || "Không gửi được yêu cầu" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-xl font-semibold">Mở Shop</h1>
      <p className="muted text-sm mt-1">Tạo shop để bắt đầu đăng bán sản phẩm. Sau khi gửi, Admin sẽ xét duyệt.</p>

      {msg ? (
        <div className={"mt-4 card p-4 " + (msg.type === "error" ? "text-red-700 bg-red-50 border-red-100" : "text-emerald-800 bg-emerald-50 border-emerald-100")}>{msg.text}</div>
      ) : null}

      {user?.role === "SELLER" && shop ? (
        <div className="mt-6 card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Bạn đã là Seller</div>
              <div className="muted text-sm">Shop: <span className="font-medium text-slate-900">{shop.name}</span></div>
            </div>
            <Link to="/seller" className="btn-primary">Vào Seller Center</Link>
          </div>
        </div>
      ) : null}

      {existingProfile ? (
        <div className="mt-6 card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Yêu cầu mở shop</div>
              <div className="muted text-sm">Trạng thái: <StatusPill status={existingProfile.status} /></div>
              {existingProfile.reason ? <div className="text-sm text-red-700 mt-2">Lý do: {existingProfile.reason}</div> : null}
            </div>
            {existingProfile.status === "REJECTED" ? (
              <div className="text-sm muted">Bạn có thể tạo lại yêu cầu bằng tài khoản khác hoặc liên hệ Admin.</div>
            ) : (
              <div className="text-sm muted">Vui lòng chờ duyệt.</div>
            )}
          </div>
        </div>
      ) : null}

      {canApply ? (
        <div className="mt-6 card p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="label mb-1">Tên Shop</div>
              <input className="input" value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} placeholder="VD: Shop Thời Trang ABC" />
            </div>
            <div>
              <div className="label mb-1">Số điện thoại</div>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="VD: 090..." />
            </div>
            <div>
              <div className="label mb-1">Mã số thuế</div>
              <input className="input" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="Nếu có" />
            </div>
            <div>
              <div className="label mb-1">Link giấy tờ KYC</div>
              <input className="input" value={form.kycDocumentUrl} onChange={(e) => setForm({ ...form, kycDocumentUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <button className="btn-primary mt-4" disabled={submitting} onClick={submit}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu mở shop"}
          </button>
        </div>
      ) : null}

      {!user ? (
        <div className="mt-6 card p-6">
          <div className="muted">Bạn cần đăng nhập để mở shop.</div>
          <Link to="/login" className="btn-primary mt-3">Đăng nhập</Link>
        </div>
      ) : null}
    </div>
  );
}
