import { useEffect, useMemo, useState } from "react";
import { sellerApi } from "../../api/seller";
import { publicApi } from "../../api/public";

import "./SellerProducts.css";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function SellerProductsModal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className="modal seller-products__modal">
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button className="btn" onClick={onClose} type="button">
            Đóng
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export default function SellerProducts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  function onImportFileChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) {
      setImportFile(null);
      return;
    }
    const ext = (f.name || "").toLowerCase();
    if (!(ext.endsWith(".xlsx") || ext.endsWith(".xls"))) {
      setError("Vui lòng chọn file Excel (.xlsx/.xls)");
      setImportFile(null);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("File quá lớn. Tối đa 8MB.");
      setImportFile(null);
      return;
    }
    setImportFile(f);
  }

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

  async function downloadTemplate() {
    setError(null);
    const res = await sellerApi.downloadProductImportTemplate();
    if (!res?.success) {
      setError(res?.message || "Không tải được template");
      return;
    }
    const blob = res.data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function importExcel() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    setError(null);
    try {
      const res = await sellerApi.importProductsExcel(importFile);
      if (res?.success) {
        setImportResult(res.data);
        setImportFile(null);
        await loadAll();
      } else {
        setError(res?.message || "Import thất bại");
      }
    } finally {
      setImporting(false);
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

  async function updateSkuCostPrice(skuId, costPrice) {
    try {
      const v = costPrice === "" || costPrice == null ? null : Number(costPrice);
      await sellerApi.updateSku(skuId, { costPrice: v == null ? undefined : v });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Không cập nhật được giá nhập SKU");
    }
  }

  return (
    <section className="seller-products">
      <header className="seller-products__header">
        <div>
          <h1 className="seller-products__title">Sản phẩm</h1>
          <p className="muted seller-products__subtitle">Quản lý danh sách sản phẩm, tồn kho và trạng thái hiển thị.</p>
        </div>
        <div className="seller-products__headerActions">
          <button className="btn-primary" onClick={openCreate} type="button">
            + Thêm sản phẩm
          </button>
        </div>
      </header>

      <div className="seller-products__infoGrid">
        <div className="section seller-products__import">
          <div className="section__head">
            <div>
              <div className="section__title">Import nhanh bằng Excel</div>
              <div className="section__sub">Tải file mẫu → điền dữ liệu → import. Hệ thống sẽ tạo mới/cập nhật theo <b>skuCode</b>.</div>
            </div>
            <div className="seller-products__headActions">
              <button className="btn" onClick={downloadTemplate} type="button">Tải file mẫu</button>
              <button className="btn" disabled={!importFile || importing} onClick={importExcel} type="button">
                {importing ? "Đang import..." : "Import"}
              </button>
            </div>
          </div>
          <div className="section__body">
            <div className="seller-products__file">
              <label className="seller-products__fileDrop">
                <div className="seller-products__fileMeta">
                  <div>
                    <div className="seller-products__fileName">{importFile ? importFile.name : "Chọn file Excel (.xlsx/.xls)"}</div>
                    <div className="seller-products__fileHint">Tối đa 8MB · Có thể sắp xếp lại cột miễn đúng header</div>
                  </div>
                  <div className="muted seller-products__fileCta">Nhấn để chọn</div>
                </div>
                <input className="seller-products__fileInput" type="file" accept=".xlsx,.xls" onChange={onImportFileChange} />
              </label>

              {importFile ? (
                <div className="seller-products__fileActions">
                  <button className="btn-secondary" type="button" onClick={() => setImportFile(null)}>
                    Bỏ chọn file
                  </button>
                </div>
              ) : null}
            </div>

            <div className="seller-products__importNotes">
              <div className="seller-products__note"><span className="seller-products__bullet">•</span> <b>Bắt buộc</b>: <code>name</code>, <code>price</code></div>
              <div className="seller-products__note"><span className="seller-products__bullet">•</span> <code>categorySlug</code>: slug hoặc tên danh mục (không có sẽ để trống)</div>
              <div className="seller-products__note"><span className="seller-products__bullet">•</span> <code>imageUrls</code>: nhiều link, cách nhau bằng dấu phẩy</div>
              <div className="seller-products__note"><span className="seller-products__bullet">•</span> <code>status</code>: ACTIVE / HIDDEN / DRAFT</div>
            </div>
          </div>
        </div>

        <div className="section seller-products__tips">
          <div className="section__head">
            <div>
              <div className="section__title">Mẹo tránh lỗi</div>
              <div className="section__sub">Giảm lỗi validate khi import số lượng lớn.</div>
            </div>
          </div>
          <div className="section__body">
            <div className="seller-products__tipsList">
              <div className="seller-products__tipItem">• Giá và số lượng nên là số (không ký tự lạ).</div>
              <div className="seller-products__tipItem">• Link ảnh nên là https:// công khai.</div>
              <div className="seller-products__tipItem">• Nên dùng <b>skuCode</b> cố định để lần sau import là cập nhật.</div>
            </div>
          </div>
        </div>
      </div>

      {importResult ? (
        <div className="card seller-products__importResult">
          <div className="seller-products__importTitle">Kết quả import</div>
          <div className="seller-products__importSummary">Tạo mới: <b>{importResult.created}</b> · Cập nhật: <b>{importResult.updated}</b> · Lỗi: <b>{(importResult.errors || []).length}</b></div>
          {(importResult.errors || []).length ? (
            <div className="seller-products__importErrors">
              {(importResult.errors || []).slice(0, 50).map((e, idx) => (
                <div key={idx} className="seller-products__importError">Dòng {e.row}: {e.message}</div>
              ))}
              {(importResult.errors || []).length > 50 ? <div className="muted seller-products__importMore">Chỉ hiển thị 50 lỗi đầu tiên...</div> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="alert alert--danger seller-products__alert">{error}</div> : null}

      {loading ? (
        <div className="muted seller-products__loading">Đang tải...</div>
      ) : products.length === 0 ? (
        <div className="card seller-products__empty">Chưa có sản phẩm. Nhấn <span className="seller-products__strong">Thêm sản phẩm</span> để tạo mới.</div>
      ) : (
        <div className="card seller-products__tableCard">
          <div className="seller-products__tableWrap">
            <table className="table table--tiki seller-products__table" aria-label="Danh sách sản phẩm">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Giá</th>
                  <th>Tồn kho</th>
                  <th>Trạng thái</th>
                  <th className="seller-products__thRight">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stock = (p.skus || []).reduce((s, sku) => s + Number(sku.stock || 0), 0);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="seller-products__productCell">
                          <img
                            src={p.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"}
                            alt={p.name}
                            className="seller-products__thumb"
                          />
                          <div>
                            <div className="seller-products__name">{p.name}</div>
                            <div className="muted seller-products__slug">Slug: {p.slug}</div>
                            <div className="seller-products__skuList">
                              {(p.skus || []).map((sku) => (
                                <div key={sku.id} className="seller-products__skuRow">
                                  <span className="seller-products__skuPill">SKU: {sku.name}</span>
                                  <span className="muted seller-products__skuLabel">stock:</span>
                                  <input
                                    className="input-sm seller-products__skuInput"
                                    type="number"
                                    min={0}
                                    defaultValue={sku.stock}
                                    onBlur={(e) => updateSkuStock(sku.id, e.target.value)}
                                  />
                                  <span className="muted seller-products__skuLabel">cost:</span>
                                  <input
                                    className="input-sm seller-products__skuInput seller-products__skuInput--cost"
                                    type="number"
                                    min={0}
                                    defaultValue={sku.costPrice == null ? "" : sku.costPrice}
                                    placeholder="giá nhập"
                                    onBlur={(e) => updateSkuCostPrice(sku.id, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="seller-products__price">{formatVND(p.price)}</td>
                      <td>{stock}</td>
                      <td>
                        <select className="select" value={p.status} onChange={(e) => changeStatus(p, e.target.value)}>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="HIDDEN">HIDDEN</option>
                          <option value="DRAFT">DRAFT</option>
                        </select>
                      </td>
                      <td className="seller-products__tdRight">
                        <button className="btn" onClick={() => openEdit(p)} type="button">Sửa</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SellerProductsModal open={modalOpen} title={editing ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setModalOpen(false)}>
        <form className="seller-products__form" onSubmit={saveProduct}>
          <div className="seller-products__formGrid2">
            <div className="seller-products__field">
              <div className="label seller-products__label">Tên sản phẩm</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="seller-products__field">
              <div className="label seller-products__label">Danh mục</div>
              <select className="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">(Không chọn)</option>
                {categoryFlat.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="seller-products__formGrid3">
            <div className="seller-products__field">
              <div className="label seller-products__label">Giá</div>
              <input className="input" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div className="seller-products__field">
              <div className="label seller-products__label">Giá gạch (tuỳ chọn)</div>
              <input className="input" type="number" min={0} value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
            </div>
            <div className="seller-products__field">
              <div className="label seller-products__label">Trạng thái</div>
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          <div className="seller-products__field">
            <div className="label seller-products__label">Ảnh thumbnail URL (tuỳ chọn)</div>
            <input className="input" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
          </div>

          <div className="seller-products__field">
            <div className="label seller-products__label">Mô tả (tuỳ chọn)</div>
            <textarea className="textarea seller-products__textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="seller-products__formActions">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>Huỷ</button>
            <button className="btn-primary" type="submit">{editing ? "Lưu thay đổi" : "Tạo sản phẩm"}</button>
          </div>
        </form>
      </SellerProductsModal>
    </section>
  );
}
