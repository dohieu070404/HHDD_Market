import { useMemo, useState } from "react";
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
    <div className="container-page py-10">
      <div className="mx-auto max-w-md card p-6">
        <h1 className="text-xl font-semibold">Đăng ký</h1>
        <p className="muted text-sm mt-1">Tạo tài khoản để mua sắm và theo dõi đơn hàng.</p>

        {msg ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null}

        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <div>
            <div className="label mb-1">Email</div>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div>
            <div className="label mb-1">Username</div>
            <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="tennguoidung" />
          </div>
          <div>
            <div className="label mb-1">Tên hiển thị (tuỳ chọn)</div>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" />
          </div>

          <div>
            <div className="label mb-1">Mật khẩu</div>
            <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <div className="mt-2 flex items-center justify-between text-xs">
              <div className="muted">Độ mạnh: <span className="font-medium text-slate-900">{strength.label}</span></div>
              <div className="muted">Gợi ý: 8+ ký tự, hoa/thường, số, ký tự đặc biệt</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-slate-800" style={{ width: `${(strength.score / 4) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="label mb-1">Nhập lại mật khẩu</div>
            <input type="password" className="input" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </div>

          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Đang tạo tài khoản..." : "Đăng ký"}
          </button>
        </form>

        <div className="mt-4 text-sm muted">
          Đã có tài khoản? <Link to="/login" className="underline">Đăng nhập</Link>
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
          <div className="font-medium">Mẹo đặt mật khẩu</div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Tránh dùng thông tin dễ đoán (tên, ngày sinh)</li>
            <li>Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
            <li>Không dùng lại mật khẩu giữa nhiều website</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
