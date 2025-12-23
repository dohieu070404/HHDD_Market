import { useEffect, useState } from "react";
import { sellerApi } from "../../api/seller";

export default function SellerSettings() {
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", logoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await sellerApi.getShop();
      setShop(res.data);
      setForm({
        name: res.data.name || "",
        description: res.data.description || "",
        logoUrl: res.data.logoUrl || "",
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSave(e) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    try {
      const payload = {
        name: form.name || undefined,
        description: form.description || undefined,
        logoUrl: form.logoUrl || undefined,
      };
      const res = await sellerApi.updateShop(payload);
      setMsg(res.message || "Đã cập nhật");
      setShop(res.data);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Thiết lập shop</h1>
          <p className="text-sm text-slate-600">Cập nhật thông tin cửa hàng để hiển thị chuyên nghiệp hơn.</p>
        </div>
      </div>

      {msg ? <div className="card border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</div> : null}
      {err ? <div className="card border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{err}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tên shop</label>
              <input className="input" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">Logo URL</label>
              <input className="input" value={form.logoUrl} onChange={(e) => setForm((s) => ({ ...s, logoUrl: e.target.value }))} />
              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {form.logoUrl ? <img src={form.logoUrl} alt="logo" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="text-xs text-slate-600">Bạn có thể dùng link ảnh công khai (https)</div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                className="input min-h-[120px]"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={loading}>
                Lưu thay đổi
              </button>
              <button className="btn" type="button" onClick={load} disabled={loading}>
                Tải lại
              </button>
            </div>
          </form>
        </div>

        <div className="card p-4">
          <div className="text-sm font-semibold">Thông tin hệ thống</div>
          {loading ? (
            <div className="mt-3 text-sm text-slate-600">Đang tải...</div>
          ) : shop ? (
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-500">Slug</div>
                <div className="font-mono">{shop.slug}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Trạng thái</div>
                <div className="font-medium">{shop.status}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Rating</div>
                <div className="font-medium">{Number(shop.ratingAvg || 0).toFixed(1)} ({shop.ratingCount || 0})</div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-rose-600">Không load được shop.</div>
          )}
        </div>
      </div>
    </div>
  );
}
