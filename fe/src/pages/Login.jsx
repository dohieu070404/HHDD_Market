import { useState } from "react";
import "./Auth.css";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ? decodeURIComponent(params.get("next")) : "/";

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await login(form.identifier, form.password);
      if (res?.success) {
        navigate(next);
      } else {
        setMsg(res?.message || "Đăng nhập thất bại");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="container-page auth-page__container">
        <div className="card auth-card">
          <h1 className="auth-card__title">Đăng nhập</h1>
          <p className="muted auth-card__subtitle">Chào mừng quay lại. Hãy đăng nhập để tiếp tục mua sắm.</p>

          {msg ? <div className="auth-card__alert auth-card__alert--error">{msg}</div> : null}

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-form__field">
              <div className="label auth-form__label">Email hoặc Username</div>
            <input
              className="input"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="email@example.com"
            />
            </div>
            <div className="auth-form__field">
              <div className="label auth-form__label">Mật khẩu</div>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            </div>

            <button className="btn-primary auth-form__submit" disabled={submitting}>
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <div className="muted auth-card__footer">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="auth-card__footerLink">
              Đăng ký
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
