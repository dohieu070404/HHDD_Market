import { useEffect, useMemo, useState } from "react";
import { sellerApi } from "../../api/seller";
import { publicApi } from "../../api/public";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-lg font-semibold">{title}</div>
          <button className="btn" onClick={onClose}>Đóng</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function SellerProducts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    price: 0,
    compareAtPrice: "",
    thumbnailUrl: "",
    description: "",
    categoryId: "",
    status: "ACTIVE",
  });

  const categoryFlat = useMemo(() => {
    const out = [];
    for (const c of categories || []) {
      out.push({ id: c.id, name: c.name, depth: 0 });
      for (const child of c.children || []) {
        out.push({ id: child.id, name: `${c.name} / ${child.name}`, depth: 1 });
      }
    }
    return out;
  }, [categories]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes] = await Promise.all([sellerApi.listProducts(), publicApi.listCategories()]);
      setProducts(pRes?.data || []);
      setCategories(cRes?.data || []);
    } catch (e) {
      setError(e?.message || "Không tải được dữ liệu sản phẩm");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", price: 0, compareAtPrice: "", thumbnailUrl: "", description: "", categoryId: "", status: "ACTIVE" });
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name || "",
      price: Number(p.price || 0),
      compareAtPrice: p.compareAtPrice == null ? "" : String(p.compareAtPrice),
      thumbnailUrl: p.thumbnailUrl || "",
      description: p.description || "",
      categoryId: p.categoryId == null ? "" : String(p.categoryId),
      status: p.status || "ACTIVE",
    });
    setModalOpen(true);
  }

  async function saveProduct(e) {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        name: form.name,
        price: Number(form.price || 0),
        compareAtPrice: form.compareAtPrice === "" ? undefined : Number(form.compareAtPrice),
        thumbnailUrl: form.thumbnailUrl || undefined,
        description: form.description || undefined,
        categoryId: form.categoryId === "" ? undefined : Number(form.categoryId),
        status: form.status,
      };
      if (editing) {
        await sellerApi.updateProduct(editing.id, payload);
      } else {
        await sellerApi.createProduct(payload);
      }
      setModalOpen(false);
      await loadAll();
    } catch (e) {
      setError(e?.message || "Lưu sản phẩm thất bại");
    }
  }

  async function changeStatus(p, status) {
    try {
      await sellerApi.setProductVisibility(p.id, status);
      await loadAll();
    } catch (e) {
      setError(e?.message || "Không cập nhật được trạng thái");
    }
  }

  async function updateSkuStock(skuId, stock) {
    try {
      await sellerApi.updateSku(skuId, { stock: Number(stock) });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Không cập nhật được tồn kho SKU");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Sản phẩm</h1>
          <p className="muted text-sm mt-1">Quản lý danh sách sản phẩm, tồn kho và trạng thái hiển thị.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Thêm sản phẩm</button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="mt-6 muted">Đang tải...</div>
      ) : products.length === 0 ? (
        <div className="mt-6 card p-6">Chưa có sản phẩm. Nhấn <span className="font-medium">Thêm sản phẩm</span> để tạo mới.</div>
      ) : (
        <div className="mt-6 card p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 text-left font-semibold">Giá</th>
                  <th className="px-4 py-3 text-left font-semibold">Tồn kho</th>
                  <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => {
                  const stock = (p.skus || []).reduce((s, sku) => s + Number(sku.stock || 0), 0);
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"}
                            alt={p.name}
                            className="h-12 w-12 rounded-lg object-cover border"
                          />
                          <div>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs muted">Slug: {p.slug}</div>
                            <div className="mt-2">
                              {(p.skus || []).map((sku) => (
                                <div key={sku.id} className="flex items-center gap-2 text-xs text-slate-700">
                                  <span className="rounded-md bg-slate-100 px-2 py-0.5">SKU: {sku.name}</span>
                                  <span className="muted">stock:</span>
                                  <input
                                    className="input h-8 w-24"
                                    type="number"
                                    min={0}
                                    defaultValue={sku.stock}
                                    onBlur={(e) => updateSkuStock(sku.id, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatVND(p.price)}</td>
                      <td className="px-4 py-3">{stock}</td>
                      <td className="px-4 py-3">
                        <select className="input" value={p.status} onChange={(e) => changeStatus(p, e.target.value)}>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="HIDDEN">HIDDEN</option>
                          <option value="DRAFT">DRAFT</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="btn" onClick={() => openEdit(p)}>Sửa</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} title={editing ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setModalOpen(false)}>
        <form className="grid gap-3" onSubmit={saveProduct}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="label mb-1">Tên sản phẩm</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <div className="label mb-1">Danh mục</div>
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">(Không chọn)</option>
                {categoryFlat.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="label mb-1">Giá</div>
              <input className="input" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <div className="label mb-1">Giá gạch (tuỳ chọn)</div>
              <input className="input" type="number" min={0} value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
            </div>
            <div>
              <div className="label mb-1">Trạng thái</div>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          <div>
            <div className="label mb-1">Ảnh thumbnail URL (tuỳ chọn)</div>
            <input className="input" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
          </div>

          <div>
            <div className="label mb-1">Mô tả (tuỳ chọn)</div>
            <textarea className="input min-h-[120px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>Huỷ</button>
            <button className="btn-primary" type="submit">{editing ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
