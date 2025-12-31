import { useMemo, useState } from "react";
import "./Auth.css";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { passwordStrength } from "../utils/passwordStrength";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", name: "", password: "", confirm: "" });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (!form.email || !form.username || !form.password) {
      setMsg("Vui lòng nhập email, username và mật khẩu");
      return;
    }
    if (form.password !== form.confirm) {
      setMsg("Mật khẩu nhập lại không khớp");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        ...(form.name?.trim() ? { firstName: form.name.trim() } : {}),
      };

      const res = await register(payload);

      if (res?.success) {
        navigate("/login");
      } else {
        setMsg(res?.message || "Đăng ký thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="container-page auth-page__container">
        <div className="card auth-card">
          <h1 className="auth-card__title">Đăng ký</h1>
          <p className="muted auth-card__subtitle">Tạo tài khoản để mua sắm và theo dõi đơn hàng.</p>

          {msg ? <div className="auth-card__alert auth-card__alert--error">{msg}</div> : null}

          <form className="auth-form" onSubmit={submit}>
            <div>
              <div className="label auth-form__label">Email</div>
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </div>
            <div>
              <div className="label auth-form__label">Username</div>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="tennguoidung" />
            </div>
            <div>
              <div className="label auth-form__label">Tên hiển thị (tuỳ chọn)</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" />
            </div>

            <div>
              <div className="label auth-form__label">Mật khẩu</div>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <div className="auth-strength">
                <div className="auth-strength__row">
                  <div className="muted auth-strength__text">Độ mạnh: <span className="auth-strength__label">{strength.label}</span></div>
                  <div className="muted auth-strength__hint">Gợi ý: 8+ ký tự, hoa/thường, số, ký tự đặc biệt</div>
                </div>
                <div className="auth-strength__bar" aria-hidden>
                  <div className="auth-strength__barFill" style={{ width: `${(strength.score / 4) * 100}%` }} />
                </div>
              </div>
            </div>
            <div>
              <div className="label auth-form__label">Nhập lại mật khẩu</div>
              <input type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            </div>

            <button className="btn-primary auth-form__submit" disabled={submitting}>
              {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
            </button>
          </form>

          <div className="muted auth-card__footer">
            Đã có tài khoản? <Link to="/login" className="auth-card__footerLink">Đăng nhập</Link>
          </div>

          <div className="auth-tips">
            <div className="auth-tips__title">Mẹo đặt mật khẩu</div>
            <ul className="auth-tips__list">
              <li>Tránh dùng thông tin dễ đoán (tên, ngày sinh)</li>
              <li>Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
              <li>Không dùng lại mật khẩu giữa nhiều website</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
