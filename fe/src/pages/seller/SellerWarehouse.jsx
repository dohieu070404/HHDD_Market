import { useEffect, useMemo, useState } from "react";
import { sellerApi } from "../../api/seller";
import { publicApi } from "../../api/public";
import Dropzone from "../../components/Dropzone";
import { uploadWithProgress } from "../../utils/uploadWithProgress";
import { useToast } from "../../contexts/ToastContext";

import "./SellerWarehouse.css";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function WarehouseModal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title || "Modal"}>
      <div className="modal seller-warehouse__modal">
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

export default function SellerWarehouse() {
  const { push } = useToast();
  const [tab, setTab] = useState("list"); // list | import
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Import
  const [mode, setMode] = useState("upsert"); // upsert | replace
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    sellPrice: "0", // Giá bán thường
    flashSalePrice: "", // Giá Flash Sale (tuỳ chọn)
    // Default SKU fields (manual create)
    skuCode: "",
    stock: "0",
    costPrice: "",
    weightGram: "",
    // Images
    thumbnailUrl: "",
    imageUrls: "",
    description: "",
    categoryId: "",
    status: "ACTIVE",
  });

  const categoryFlat = useMemo(() => {
    const out = [];
    for (const c of categories || []) {
      out.push({ id: c.id, name: c.name });
      for (const child of c.children || []) out.push({ id: child.id, name: `${c.name} / ${child.name}` });
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
      setError(e?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

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

  function validateExcelFile(f) {
    if (!f) return "";
    const ext = (f.name || "").toLowerCase();
    if (!(ext.endsWith(".xlsx") || ext.endsWith(".xls"))) return "Vui lòng chọn file Excel (.xlsx/.xls)";
    if (f.size > 8 * 1024 * 1024) return "File quá lớn. Tối đa 8MB.";
    return "";
  }

  async function importExcel() {
    if (!importFile) return;
    if (mode === "replace" && !confirmReplace) {
      push({ type: "error", title: "Chưa xác nhận", message: "Vui lòng tick xác nhận khi dùng chế độ Thay thế toàn bộ." });
      return;
    }
    const v = validateExcelFile(importFile);
    if (v) {
      push({ type: "error", title: "File không hợp lệ", message: v });
      return;
    }

    setImporting(true);
    setImportPct(0);
    setImportResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await uploadWithProgress({
        path: `/seller/products/import-excel?mode=${encodeURIComponent(mode)}`,
        formData: fd,
        onProgress: setImportPct,
      });
      if (res?.success) {
        setImportResult(res.data);
        push({ type: "success", title: "Import thành công", message: `Tạo mới ${res.data?.created || 0}, cập nhật ${res.data?.updated || 0}` });
        setImportFile(null);
        setConfirmReplace(false);
        await loadAll();
      } else {
        push({ type: "error", title: "Import thất bại", message: res?.message || "Import thất bại" });
      }
    } catch (e) {
      push({ type: "error", title: "Import thất bại", message: e?.data?.message || "Import thất bại" });
    } finally {
      setImporting(false);
      setImportPct(0);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      sellPrice: "0",
      flashSalePrice: "",
      skuCode: "",
      stock: "0",
      costPrice: "",
      weightGram: "",
      thumbnailUrl: "",
      imageUrls: "",
      description: "",
      categoryId: "",
      status: "ACTIVE",
    });
    setModalOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    const firstSku = (p.skus || [])[0];

    // UI: Seller nhập theo "Giá bán" và "Giá Flash Sale".
    // DB: price = giá hiện tại (thường là flash sale nếu có), compareAtPrice = giá bán thường (gạch).
    const pPrice = Number(p.price || 0);
    const pCompare = p.compareAtPrice == null ? null : Number(p.compareAtPrice || 0);
    let sellPrice = pPrice;
    let flashSalePrice = "";
    if (pCompare != null && Number.isFinite(pCompare) && pCompare > 0 && pCompare !== pPrice) {
      sellPrice = Math.max(pPrice, pCompare);
      flashSalePrice = String(Math.min(pPrice, pCompare));
    }

    setForm({
      name: p.name || "",
      sellPrice: String(sellPrice),
      flashSalePrice,
      skuCode: firstSku?.skuCode || "",
      stock: String(firstSku?.stock ?? 0),
      costPrice: firstSku?.costPrice == null ? "" : String(firstSku.costPrice),
      weightGram: firstSku?.weightGram == null ? "" : String(firstSku.weightGram),
      thumbnailUrl: p.thumbnailUrl || "",
      imageUrls: "",
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
      const sell = Number(form.sellPrice || 0);
      const flash = form.flashSalePrice === "" ? null : Number(form.flashSalePrice);
      // Always store the lower price as "price" (current/checkout), higher price as compareAtPrice (strike-through)
      // to be robust even if seller swaps inputs.
      let price = sell;
      // Always send null when no strike-through price, so seller can clear it.
      let compareAtPrice = null;
      if (flash != null && Number.isFinite(flash) && flash > 0 && flash !== sell) {
        price = Math.min(sell, flash);
        compareAtPrice = Math.max(sell, flash);
      }

      const payload = {
        name: form.name,
        price,
        compareAtPrice,
        // Default SKU fields (used when creating; update endpoint will ignore unknown keys)
        skuCode: form.skuCode ? String(form.skuCode).trim() : undefined,
        stock: form.stock === "" ? undefined : Number(form.stock || 0),
        costPrice: form.costPrice === "" ? undefined : Number(form.costPrice),
        weightGram: form.weightGram === "" ? undefined : Number(form.weightGram),
        thumbnailUrl: form.thumbnailUrl || undefined,
        imageUrls: form.imageUrls || undefined,
        description: form.description || undefined,
        categoryId: form.categoryId === "" ? undefined : Number(form.categoryId),
        status: form.status,
      };

      if (editing) {
        // Update product basic fields
        await sellerApi.updateProduct(editing.id, payload);

        // Update default SKU costPrice from this modal (optional)
        const firstSkuId = (editing.skus || [])[0]?.id;
        const nextCost = form.costPrice === "" ? null : Number(form.costPrice);
        if (firstSkuId && nextCost != null && Number.isFinite(nextCost)) {
          await sellerApi.updateSku(firstSkuId, { costPrice: nextCost });
        }
      } else {
        await sellerApi.createProduct(payload);
      }
      setModalOpen(false);
      await loadAll();
      push({ type: "success", title: "Đã lưu", message: editing ? "Cập nhật sản phẩm thành công" : "Tạo sản phẩm thành công" });
    } catch (e) {
      setError(e?.message || "Lưu sản phẩm thất bại");
    }
  }

  async function deleteProduct(p) {
    const ok = window.confirm(
      `Bạn chắc chắn muốn XOÁ HẲN sản phẩm "${p.name}"?\n\n- Sản phẩm sẽ bị xoá khỏi kho và không thể khôi phục.\n- Nếu sản phẩm đã phát sinh đơn hàng, hệ thống sẽ không cho xoá (để không mất lịch sử).`
    );
    if (!ok) return;
    try {
      await sellerApi.deleteProduct(p.id);
      push({ type: "success", title: "Đã xoá", message: "Sản phẩm đã được xoá khỏi hệ thống" });
      await loadAll();
    } catch (e) {
      push({ type: "error", title: "Xoá thất bại", message: e?.message || "Không xoá được sản phẩm" });
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

  async function updateSku(skuId, payload) {
    try {
      await sellerApi.updateSku(skuId, payload);
      await loadAll();
      push({ type: "success", title: "Đã cập nhật", message: "Tồn kho/giá nhập đã được lưu" });
    } catch (e) {
      setError(e?.message || "Không cập nhật được SKU");
    }
  }

  return (
    <section className="seller-warehouse">
      <header className="seller-warehouse__header">
        <div>
          <h1 className="seller-warehouse__title">Kho hàng</h1>
          <p className="seller-warehouse__subtitle muted">Gộp quản lý sản phẩm + tồn kho. Import Excel nhanh, có chế độ an toàn.</p>
        </div>
        <div className="seller-warehouse__headerActions">
          {tab === "list" ? (
            <button className="btn-primary" onClick={openCreate} type="button">
              + Thêm sản phẩm
            </button>
          ) : null}
        </div>
      </header>

      <div className="seller-warehouse__tabs" role="tablist" aria-label="Warehouse tabs">
        <div className="segmented">
          <button className={`segmented__btn ${tab === "list" ? "is-active" : ""}`} onClick={() => setTab("list")} type="button">
            Danh sách
          </button>
          <button className={`segmented__btn ${tab === "import" ? "is-active" : ""}`} onClick={() => setTab("import")} type="button">
            Import Excel
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--danger seller-warehouse__alert">{error}</div> : null}

      {tab === "import" ? (
        <div className="seller-warehouse__importGrid">
          <div className="section seller-warehouse__importMain">
            <div className="section__head">
              <div>
                <div className="section__title">Import sản phẩm bằng Excel</div>
                <div className="section__sub">
                  Chọn chế độ rồi tải file lên. Hệ thống sẽ <b>tạo mới/cập nhật theo skuCode</b>.
                </div>
              </div>
              <div className="seller-warehouse__sectionActions">
                <button className="btn" onClick={downloadTemplate} type="button">
                  Tải file mẫu
                </button>
              </div>
            </div>

            <div className="section__body">
              <div className="seller-warehouse__importActions">
                <div className="segmented" role="group" aria-label="Chế độ import">
                  <button
                    className={`segmented__btn ${mode === "upsert" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => {
                      setMode("upsert");
                      setConfirmReplace(false);
                    }}
                  >
                    Thêm/Cập nhật
                  </button>
                  <button
                    className={`segmented__btn ${mode === "replace" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setMode("replace")}
                  >
                    Thay thế toàn bộ
                  </button>
                </div>

                <button
                  className="btn-primary"
                  type="button"
                  disabled={!importFile || importing || (mode === "replace" && !confirmReplace)}
                  onClick={importExcel}
                >
                  {importing ? "Đang import..." : "Import"}
                </button>
              </div>

              <div className="seller-warehouse__dropzone">
                <Dropzone
                  accept=".xlsx,.xls"
                  label={importFile ? `Đã chọn: ${importFile.name}` : "Tải tài liệu lên"}
                  hint={mode === "upsert" ? "(Thêm mới hoặc cập nhật theo skuCode)" : "(Thay thế toàn bộ kho hàng của shop)"}
                  onFile={(f) => {
                    setImportResult(null);
                    setError(null);
                    if (!f) {
                      setImportFile(null);
                      return;
                    }
                    const msg = validateExcelFile(f);
                    if (msg) {
                      push({ type: "error", title: "File không hợp lệ", message: msg });
                      setImportFile(null);
                      return;
                    }
                    setImportFile(f);
                  }}
                />
              </div>

              {mode === "replace" ? (
                <div className="alert alert--warning seller-warehouse__warning">
                  <div className="seller-warehouse__warningTitle">Lưu ý</div>
                  <div className="seller-warehouse__warningText">
                    Chế độ <b>Thay thế</b> sẽ ẩn toàn bộ sản phẩm hiện có của shop (không xóa dữ liệu), sau đó import lại từ file.
                  </div>
                  <label className="seller-warehouse__confirm">
                    <input type="checkbox" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
                    Tôi hiểu và muốn tiếp tục
                  </label>
                </div>
              ) : (
                <div className="seller-warehouse__tip">
                  <b>Gợi ý:</b> hãy dùng <code>skuCode</code> cố định để lần sau import là cập nhật, không tạo trùng.
                </div>
              )}

              <div className="seller-warehouse__tip">
                <b>Lưu ý danh mục:</b> cột <code>categorySlug</code> phải trùng với danh mục do admin tạo. Trong file mẫu của hệ thống đã có sheet <code>Categories</code> để bạn copy slug cho đúng.
              </div>

              {importing ? (
                <div className="seller-warehouse__progress">
                  <div className="progress">
                    <div style={{ width: `${importPct}%` }} />
                  </div>
                  <div className="seller-warehouse__progressText muted">Đang upload/import {importPct}%</div>
                </div>
              ) : null}

              {importResult ? (
                <div className="card seller-warehouse__result">
                  <div className="seller-warehouse__resultTitle">Kết quả import</div>
                  <div className="seller-warehouse__resultSummary">
                    Tạo mới: <b>{importResult.created}</b> · Cập nhật: <b>{importResult.updated}</b> · Lỗi: <b>{(importResult.errors || []).length}</b>
                  </div>
                  {(importResult.errors || []).length ? (
                    <div className="seller-warehouse__errorBox">
                      {(importResult.errors || []).slice(0, 50).map((e, idx) => (
                        <div key={idx} className="seller-warehouse__errorLine">
                          Dòng {e.row}: {e.message}
                        </div>
                      ))}
                      {(importResult.errors || []).length > 50 ? <div className="seller-warehouse__errorMore muted">Chỉ hiển thị 50 lỗi đầu tiên...</div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="section seller-warehouse__importAside">
            <div className="section__head">
              <div>
                <div className="section__title">Chuẩn file</div>
                <div className="section__sub">Để import mượt và ít lỗi.</div>
              </div>
            </div>
            <div className="section__body">
              <div className="seller-warehouse__rules">
                <div>• <b>Bắt buộc</b>: <code>name</code>, <code>price</code></div>
                <div>• <code>stock</code>, <code>costPrice</code> là số.</div>
                <div>• <code>imageUrls</code>: nhiều link, cách nhau dấu phẩy.</div>
                <div>• <code>status</code>: ACTIVE / HIDDEN / DRAFT.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="seller-warehouse__loading muted">Đang tải...</div>
          ) : products.length === 0 ? (
            <div className="card seller-warehouse__empty">
              Chưa có sản phẩm. Nhấn <span className="seller-warehouse__emptyEm">Thêm sản phẩm</span> để tạo mới.
            </div>
          ) : (
            <div className="card seller-warehouse__tableCard">
              <div className="seller-warehouse__tableWrap">
                <table className="table table--tiki seller-warehouse__table">
                  <thead>
                    <tr>
                      <th scope="col">Sản phẩm</th>
                      <th scope="col">Giá</th>
                      <th scope="col">Tồn kho</th>
                      <th scope="col">Giá nhập</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="seller-warehouse__thRight">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const stock = (p.skus || []).reduce((s, sku) => s + Number(sku.stock || 0), 0);
                      const cost = (p.skus || []).length ? (p.skus[0].costPrice ?? "") : "";
                      void stock;
                      void cost;
                      return (
                        <tr key={p.id}>
                          <td>
                            <div className="seller-warehouse__product">
                              <img
                                src={p.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80"}
                                alt={p.name}
                                className="seller-warehouse__thumb"
                              />
                              <div>
                                <div className="seller-warehouse__productName">{p.name}</div>
                                <div className="seller-warehouse__productSku muted">
                                  SKU: {(p.skus || []).map((s) => s.skuCode).filter(Boolean).join(", ") || "(auto)"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="seller-warehouse__price">{formatVND(p.price)}</td>
                          <td>
                            <div className="seller-warehouse__skuList">
                              {(p.skus || []).map((sku) => (
                                <div key={sku.id} className="seller-warehouse__skuRow">
                                  <input
                                    className="input input-sm seller-warehouse__stockInput"
                                    type="number"
                                    min={0}
                                    defaultValue={sku.stock}
                                    onBlur={(e) => updateSku(sku.id, { stock: Number(e.target.value) })}
                                  />
                                  <span className="seller-warehouse__skuNote muted">({sku.name})</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            <div className="seller-warehouse__skuList">
                              {(p.skus || []).map((sku) => (
                                <div key={sku.id} className="seller-warehouse__skuRow">
                                  <input
                                    className="input input-sm seller-warehouse__costInput"
                                    type="number"
                                    min={0}
                                    defaultValue={sku.costPrice == null ? "" : sku.costPrice}
                                    placeholder="giá nhập"
                                    onBlur={(e) => {
                                      const v = e.target.value === "" ? null : Number(e.target.value);
                                      updateSku(sku.id, { costPrice: v == null ? undefined : v });
                                    }}
                                  />
                                  <span className="seller-warehouse__skuNote muted">({sku.name})</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td>
                            <select className="input select-sm" value={p.status} onChange={(e) => changeStatus(p, e.target.value)}>
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="HIDDEN">HIDDEN</option>
                              <option value="DRAFT">DRAFT</option>
                            </select>
                          </td>
                          <td className="seller-warehouse__tdRight">
                            <button className="btn" onClick={() => openEdit(p)} type="button">
                              Sửa
                            </button>
                            <button className="btn btn-danger" onClick={() => deleteProduct(p)} type="button">
                              Xoá
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <WarehouseModal open={modalOpen} title={editing ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setModalOpen(false)}>
        <form className="seller-warehouse__form" onSubmit={saveProduct}>
          <div className="seller-warehouse__formGrid">
            <div className="field">
              <div className="label">Tên sản phẩm</div>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <div className="label">Danh mục</div>
              <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">(Không chọn)</option>
                {categoryFlat.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="seller-warehouse__formGrid seller-warehouse__formGrid--3">
            <div className="field">
              <div className="label">Giá bán</div>
              <input
                className="input"
                type="number"
                min={0}
                value={form.sellPrice}
                onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                required
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Giá bán thường (khi không Flash Sale).
              </div>
            </div>
            <div className="field">
              <div className="label">Giá Flash Sale (tuỳ chọn)</div>
              <input
                className="input"
                type="number"
                min={0}
                value={form.flashSalePrice}
                onChange={(e) => setForm({ ...form, flashSalePrice: e.target.value })}
                placeholder="VD: 259000"
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Nếu nhập, hệ thống sẽ tự lấy giá thấp hơn để tính tiền khi mua.
              </div>
            </div>
            <div className="field">
              <div className="label">Trạng thái</div>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="HIDDEN">HIDDEN</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          </div>

          {!editing ? (
            <>
              <div className="seller-warehouse__tip">
                <b>SKU mặc định:</b> hệ thống sẽ tự tạo (không cần nhập Tên SKU). Bạn có thể chỉnh lại tồn kho/giá nhập sau ở bảng danh sách.
              </div>

              <div className="seller-warehouse__formGrid">
                <div className="field">
                  <div className="label">Mã SKU (tuỳ chọn)</div>
                  <input
                    className="input"
                    value={form.skuCode}
                    onChange={(e) => setForm({ ...form, skuCode: e.target.value })}
                    placeholder="VD: GD-KETTLE-001"
                  />
                </div>
                <div className="field">
                  <div className="label">Tồn kho</div>
                  <input className="input" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>

              <div className="seller-warehouse__formGrid seller-warehouse__formGrid--3">
                <div className="field">
                  <div className="label">Giá nhập (tuỳ chọn)</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="VD: 180000"
                  />
                </div>
                <div className="field">
                  <div className="label">Khối lượng (gram)</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.weightGram}
                    onChange={(e) => setForm({ ...form, weightGram: e.target.value })}
                    placeholder="VD: 1200"
                  />
                </div>
                <div className="field">
                  <div className="label">Danh sách ảnh URL (tuỳ chọn)</div>
                  <input
                    className="input"
                    value={form.imageUrls}
                    onChange={(e) => setForm({ ...form, imageUrls: e.target.value })}
                    placeholder="https://... , https://..."
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="seller-warehouse__tip">
                <b>Lưu ý:</b> tồn kho chỉnh trực tiếp trên bảng. Bạn có thể sửa nhanh <b>giá nhập</b> (SKU mặc định) ở đây.
              </div>

              <div className="seller-warehouse__formGrid">
                <div className="field">
                  <div className="label">Giá nhập (tuỳ chọn)</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="VD: 180000"
                  />
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    Giá nhập chỉ dùng để tính lợi nhuận (không hiển thị cho khách).
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="field">
            <div className="label">Ảnh thumbnail URL (tuỳ chọn)</div>
            <input className="input" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://..." />
          </div>

          <div className="field">
            <div className="label">Mô tả (tuỳ chọn)</div>
            <textarea className="textarea seller-warehouse__desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="seller-warehouse__formActions">
            <button type="button" className="btn" onClick={() => setModalOpen(false)}>
              Huỷ
            </button>
            <button className="btn-primary" type="submit">
              {editing ? "Lưu thay đổi" : "Tạo sản phẩm"}
            </button>
          </div>
        </form>
      </WarehouseModal>
    </section>
  );
}
