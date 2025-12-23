import { useState } from "react";
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
    <div className="container-page py-10">
      <div className="mx-auto max-w-md card p-6">
        <h1 className="text-xl font-semibold">Đăng nhập</h1>
        <p className="muted text-sm mt-1">Chào mừng quay lại. Hãy đăng nhập để tiếp tục mua sắm.</p>

        {msg ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null}

        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <div>
            <div className="label mb-1">Email hoặc Username</div>
            <input className="input" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="email@example.com" />
          </div>
          <div>
            <div className="label mb-1">Mật khẩu</div>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="mt-4 text-sm muted">
          Chưa có tài khoản? <Link to="/register" className="underline">Đăng ký</Link>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
          <div className="font-medium">Tài khoản demo (seed)</div>
          <div className="mt-2 space-y-1">
            <div><span className="font-medium">Customer:</span> customer@shop.local / Customer@123</div>
            <div><span className="font-medium">Seller:</span> seller@shop.local / Seller@123</div>
            <div><span className="font-medium">Admin:</span> admin@shop.local / Admin@123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
