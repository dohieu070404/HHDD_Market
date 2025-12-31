import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../../api/admin";

import "./AdminCategories.css";

function Tree({ nodes, depth = 0, onEdit, onDelete }) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? "admin-categories__tree" : "admin-categories__subtree"}>
      {nodes.map((c) => (
        <li key={c.id} className="admin-categories__item">
          <div className="admin-categories__node">
            <div className="admin-categories__nodeHead">
              <div className="admin-categories__meta">
                <div className="admin-categories__name">{c.name}</div>
                <div className="admin-categories__slug">slug: {c.slug}</div>
              </div>
              <div className="admin-categories__actions">
                <button className="btn-ghost" onClick={() => onEdit(c)} type="button">
                  Đổi tên
                </button>
                <button className="btn-ghost admin-categories__deleteBtn" onClick={() => onDelete(c)} type="button">
                  Xóa
                </button>
              </div>
            </div>
            {c.children && c.children.length > 0 ? <Tree nodes={c.children} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} /> : null}
          </div>
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
    <section className="admin-categories">
      <div className="card admin-categories__panel">
        <div className="admin-categories__title">Danh mục sản phẩm</div>
        <div className="admin-categories__subtitle muted">Tạo danh mục cấp cha/con (tham khảo các sàn TMĐT).</div>

        <div className="admin-categories__formGrid">
          <input
            className="input"
            placeholder="Tên danh mục"
            value={createForm.name}
            onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
          />
          <select
            className="select"
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
          <button className="btn-primary" onClick={create} type="button">
            Tạo
          </button>
        </div>

        {msg && <div className="admin-categories__msg">{msg}</div>}
      </div>

      <div className="card admin-categories__treeCard">
        {loading ? <div className="admin-categories__loading muted">Đang tải...</div> : <Tree nodes={roots} onEdit={edit} onDelete={del} />}
      </div>
    </section>
  );
}
