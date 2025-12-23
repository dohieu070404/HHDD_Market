import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";

function Tree({ nodes, depth = 0, onEdit, onDelete }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className={depth === 0 ? "space-y-2" : "mt-2 space-y-2 border-l border-slate-200 pl-4"}>
      {nodes.map((c) => (
        <li key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-[200px]">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-slate-500">slug: {c.slug}</div>
            </div>
            <div className="inline-flex items-center gap-2">
              <button className="btn btn-ghost" onClick={() => onEdit(c)}>
                Đổi tên
              </button>
              <button className="btn btn-ghost text-rose-700" onClick={() => onDelete(c)}>
                Xóa
              </button>
            </div>
          </div>
          {c.children && c.children.length > 0 ? (
            <Tree nodes={c.children} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [createForm, setCreateForm] = useState({ name: "", parentId: "" });

  const roots = useMemo(() => items.filter((c) => !c.parentId), [items]);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await adminApi.listCategories();
      setItems(res.data || []);
    } catch (e) {
      setMsg(e.message || "Không tải được danh mục.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!createForm.name.trim()) {
      setMsg("Tên danh mục không được trống");
      return;
    }
    try {
      await adminApi.createCategory({
        name: createForm.name.trim(),
        parentId: createForm.parentId ? Number(createForm.parentId) : null,
      });
      setCreateForm({ name: "", parentId: "" });
      await load();
    } catch (e) {
      setMsg(e.message || "Tạo danh mục thất bại.");
    }
  }

  async function edit(cat) {
    const name = window.prompt("Tên mới:", cat.name);
    if (!name) return;
    try {
      await adminApi.updateCategory(cat.id, { name });
      await load();
    } catch (e) {
      alert(e.message || "Không đổi tên được.");
    }
  }

  async function del(cat) {
    if (!window.confirm(`Xóa danh mục "${cat.name}"?`)) return;
    try {
      await adminApi.deleteCategory(cat.id);
      await load();
    } catch (e) {
      alert(e.message || "Không xóa được.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="text-lg font-semibold">Danh mục sản phẩm</div>
        <div className="text-sm text-slate-600">Tạo danh mục cấp cha/con (tham khảo các sàn TMĐT).</div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr,240px,auto]">
          <input
            className="input"
            placeholder="Tên danh mục"
            value={createForm.name}
            onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
          />
          <select
            className="input"
            value={createForm.parentId}
            onChange={(e) => setCreateForm((s) => ({ ...s, parentId: e.target.value }))}
          >
            <option value="">(Cấp gốc)</option>
            {items
              .filter((c) => !c.parentId)
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
          </select>
          <button className="btn btn-primary" onClick={create}>
            Tạo
          </button>
        </div>
        {msg && <div className="mt-3 text-sm text-rose-700">{msg}</div>}
      </div>

      <div className="card p-5">
        {loading ? <div className="text-slate-500">Đang tải...</div> : <Tree nodes={roots} onEdit={edit} onDelete={del} />}
      </div>
    </div>
  );
}
