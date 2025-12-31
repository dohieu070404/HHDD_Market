import { useEffect, useRef, useState } from "react";
import { sellerApi } from "../../api/seller";
import ImageCropModal from "../../components/ImageCropModal";
import { uploadWithProgress } from "../../utils/uploadWithProgress";
import { useToast } from "../../contexts/ToastContext";

import "./SellerSettings.css";

export default function SellerSettings() {
  const [shop, setShop] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", logoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const { push } = useToast();
  const [pendingFile, setPendingFile] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPct, setLogoPct] = useState(0);
  const [logoBuster, setLogoBuster] = useState(0);

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

  function onLogoFileChange(e) {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      push({ type: "error", title: "Không hợp lệ", message: "Vui lòng chọn ảnh (jpg/png/webp)." });
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      push({ type: "error", title: "Ảnh quá lớn", message: "Tối đa 4MB." });
      return;
    }
    setPendingFile(f);
    setCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadLogoCropped(blob) {
    if (!blob) return;
    setLogoUploading(true);
    setLogoPct(0);
    try {
      const fd = new FormData();
      fd.append("shopLogo", blob, "logo.jpg");
      const res = await uploadWithProgress({
        path: "/seller/shop/logo",
        formData: fd,
        onProgress: setLogoPct,
      });
      if (res?.success) {
        setForm((s) => ({ ...s, logoUrl: res.data?.logoUrl || s.logoUrl }));
        setLogoBuster(Date.now());
        push({ type: "success", title: "Thành công", message: "Đã cập nhật logo shop" });
        await load();
      } else {
        push({ type: "error", title: "Thất bại", message: res?.message || "Upload logo thất bại" });
      }
    } catch (e) {
      push({ type: "error", title: "Thất bại", message: e?.data?.message || "Upload logo thất bại" });
    } finally {
      setLogoUploading(false);
      setLogoPct(0);
      setPendingFile(null);
      setCropOpen(false);
    }
  }

  return (
    <section className="seller-settings">
      <header className="seller-settings__header">
        <div>
          <h1 className="seller-settings__title">Thiết lập shop</h1>
          <p className="seller-settings__subtitle muted">Cập nhật thông tin cửa hàng để hiển thị chuyên nghiệp hơn.</p>
        </div>
      </header>

      {msg ? <div className="alert alert--success seller-settings__alert">{msg}</div> : null}
      {err ? <div className="alert alert--danger seller-settings__alert">{err}</div> : null}

      <div className="seller-settings__grid">
        <div className="card seller-settings__formCard">
          <form onSubmit={onSave} className="seller-settings__form">
            <div className="seller-settings__field">
              <label className="label">Tên shop</label>
              <input className="input" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
            </div>

            <div className="seller-settings__field">
              <label className="label">Logo shop</label>
              <div className="seller-settings__logoRow">
                <div className="seller-settings__logo">
                  {form.logoUrl ? (
                    <img src={`${form.logoUrl}${form.logoUrl.includes("?") ? "&" : "?"}t=${logoBuster || 0}`} alt="logo" />
                  ) : (
                    <div className="seller-settings__logoPlaceholder">No logo</div>
                  )}
                </div>

                <div className="seller-settings__logoActions">
                  <button type="button" className="link-strong" onClick={() => fileRef.current?.click()}>
                    Tải ảnh lên
                  </button>
                  <div className="hint">(JPG/PNG/WEBP, tối đa 4MB)</div>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogoFileChange} />

                  {logoUploading ? (
                    <div className="seller-settings__uploading">
                      <div className="progress">
                        <div style={{ width: `${logoPct}%` }} />
                      </div>
                      <div className="muted seller-settings__uploadingText">Đang tải {logoPct}%</div>
                    </div>
                  ) : null}
                </div>
              </div>

              <details className="seller-settings__details">
                <summary className="seller-settings__summary">Hoặc dán logo URL</summary>
                <div className="seller-settings__detailsBody">
                  <input className="input" value={form.logoUrl} onChange={(e) => setForm((s) => ({ ...s, logoUrl: e.target.value }))} />
                  <div className="muted seller-settings__detailsHint">Bạn có thể dùng link ảnh công khai (https)</div>
                </div>
              </details>
            </div>

            <div className="seller-settings__field">
              <label className="label">Mô tả</label>
              <textarea className="textarea seller-settings__textarea" value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} />
            </div>

            <div className="seller-settings__actions">
              <button className="btn-primary" type="submit" disabled={loading}>
                Lưu thay đổi
              </button>
              <button className="btn-secondary" type="button" onClick={load} disabled={loading}>
                Tải lại
              </button>
            </div>
          </form>
        </div>

        <div className="card seller-settings__sysCard">
          <div className="seller-settings__sysTitle">Thông tin hệ thống</div>
          {loading ? (
            <div className="seller-settings__sysLoading muted">Đang tải...</div>
          ) : shop ? (
            <div className="seller-settings__sysList">
              <div>
                <div className="seller-settings__sysLabel">Slug</div>
                <div className="seller-settings__sysValue seller-settings__mono">{shop.slug}</div>
              </div>
              <div>
                <div className="seller-settings__sysLabel">Trạng thái</div>
                <div className="seller-settings__sysValue">{shop.status}</div>
              </div>
              <div>
                <div className="seller-settings__sysLabel">Rating</div>
                <div className="seller-settings__sysValue">
                  {Number(shop.ratingAvg || 0).toFixed(1)} ({shop.ratingCount || 0})
                </div>
              </div>
            </div>
          ) : (
            <div className="seller-settings__sysError">Không load được shop.</div>
          )}
        </div>
      </div>

      <ImageCropModal
        open={cropOpen}
        file={pendingFile}
        title="Cắt logo"
        aspect={1}
        onClose={() => {
          setCropOpen(false);
          setPendingFile(null);
        }}
        onDone={uploadLogoCropped}
      />
    </section>
  );
}
