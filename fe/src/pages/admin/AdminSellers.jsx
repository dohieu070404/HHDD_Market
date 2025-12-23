import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";

function StatusPill({ status }) {
  const map = {
    PENDING: "Chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Từ chối",
  };
  const label = map[status] || status;
  const cls =
    status === "APPROVED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "REJECTED"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function AdminSellers() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await adminApi.listSellers(status);
      setItems(res.data || []);
    } catch (e) {
      setMsg(e.message || "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  const countText = useMemo(() => `${items.length} hồ sơ`, [items]);

  async function approve(userId) {
    if (!window.confirm("Duyệt shop này?")) return;
    try {
      await adminApi.approveSeller(userId);
      await load();
    } catch (e) {
      alert(e.message || "Không duyệt được.");
    }
  }

  async function reject(userId) {
    const reason = window.prompt("Lý do từ chối (bắt buộc):", "Thông tin chưa hợp lệ");
    if (!reason) return;
    try {
      await adminApi.rejectSeller(userId, reason);
      await load();
    } catch (e) {
      alert(e.message || "Không từ chối được.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Duyệt hồ sơ mở Shop</div>
            <div className="text-sm text-slate-600">{countText}</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Trạng thái</label>
            <select className="input max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>
      </div>

      {msg && <div className="card p-4 text-sm text-rose-700">{msg}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">User</th>
                <th className="px-4 py-3 text-left font-semibold">Shop</th>
                <th className="px-4 py-3 text-left font-semibold">Phone</th>
                <th className="px-4 py-3 text-left font-semibold">Tax ID</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Đang tải...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.user?.username || it.user?.email}</div>
                      <div className="text-xs text-slate-500">{it.user?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{it.shop?.name}</div>
                      <div className="text-xs text-slate-500">/{it.shop?.slug}</div>
                    </td>
                    <td className="px-4 py-3">{it.phone || "—"}</td>
                    <td className="px-4 py-3">{it.taxId || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={it.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {it.status === "PENDING" ? (
                        <div className="inline-flex items-center gap-2">
                          <button className="btn btn-primary" onClick={() => approve(it.userId)}>
                            Duyệt
                          </button>
                          <button className="btn btn-ghost" onClick={() => reject(it.userId)}>
                            Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
