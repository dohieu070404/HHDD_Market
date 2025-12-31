import { useMemo, useState } from "react";
import "./OpenShop.css";
import { Link } from "react-router-dom";
import { authApi } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

function StatusPill({ status }) {
  const map = {
    PENDING: "Đang chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Bị từ chối",
  };

  const label = map[status] || status || "-";
  const cls =
    status === "APPROVED"
      ? "open-shop-status open-shop-status--approved"
      : status === "REJECTED"
      ? "open-shop-status open-shop-status--rejected"
      : "open-shop-status open-shop-status--pending";

  return <span className={cls}>{label}</span>;
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
    if (existingProfile) return existingProfile.status === "REJECTED";
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
    <div className="open-shop-page">
      <div className="container-page open-shop-page__container">
        <div className="open-shop-page__header">
          <div>
            <h1 className="open-shop-page__title">Mở Shop</h1>
            <p className="open-shop-page__subtitle muted">
              Tạo shop để bắt đầu đăng bán sản phẩm. Sau khi gửi, Admin sẽ xét duyệt.
            </p>
          </div>
        </div>

        {msg ? (
          <div className={"open-shop-page__alert alert " + (msg.type === "error" ? "alert--error" : "alert--success")}>
            {msg.text}
          </div>
        ) : null}

        {user?.role === "SELLER" && shop ? (
          <div className="card open-shop-card">
            <div className="open-shop-card__row">
              <div>
                <div className="open-shop-card__headline">Bạn đã là người bán</div>
                <div className="open-shop-card__meta muted">
                  Shop: <span className="open-shop-card__shopName">{shop.name}</span>
                </div>
              </div>
              <Link to="/seller" className="btn-primary">Vào Trung tâm bán hàng</Link>
            </div>
          </div>
        ) : null}

        {existingProfile ? (
          <div className="card open-shop-card">
            <div className="open-shop-card__row">
              <div>
                <div className="open-shop-card__headline">Yêu cầu mở shop</div>
                <div className="open-shop-card__meta muted">
                  Trạng thái: <StatusPill status={existingProfile.status} />
                </div>
                {existingProfile.rejectedReason ? (
                  <div className="open-shop-card__reject">
                    Lý do: {existingProfile.rejectedReason}
                  </div>
                ) : null}
              </div>
              <div className="open-shop-card__note muted">
                {existingProfile.status === "REJECTED" ? "Bạn có thể gửi lại yêu cầu ngay bên dưới." : "Vui lòng chờ duyệt."}
              </div>
            </div>
          </div>
        ) : null}

        {canApply ? (
          <div className="card open-shop-card">
            <div className="open-shop-form">
              <div className="open-shop-form__grid">
                <div className="open-shop-form__field">
                  <div className="label">Tên Shop</div>
                  <input
                    className="input"
                    value={form.shopName}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="VD: Shop Thời Trang ABC"
                  />
                </div>

                <div className="open-shop-form__field">
                  <div className="label">Số điện thoại</div>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="VD: 090..."
                  />
                </div>

                <div className="open-shop-form__field">
                  <div className="label">Mã số thuế</div>
                  <input
                    className="input"
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    placeholder="Nếu có"
                  />
                </div>

                <div className="open-shop-form__field">
                  <div className="label">Link giấy tờ KYC</div>
                  <input
                    className="input"
                    value={form.kycDocumentUrl}
                    onChange={(e) => setForm({ ...form, kycDocumentUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <button className="btn-primary open-shop-form__submit" disabled={submitting} onClick={submit}>
                {submitting ? "Đang gửi..." : "Gửi yêu cầu mở shop"}
              </button>
            </div>
          </div>
        ) : null}

        {!user ? (
          <div className="card open-shop-card">
            <div className="open-shop-needAuth">
              <div className="open-shop-needAuth__text muted">Bạn cần đăng nhập để mở shop.</div>
              <Link to="/login" className="btn-primary open-shop-needAuth__btn">Đăng nhập</Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
