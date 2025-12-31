import { useEffect, useMemo, useState } from "react";
import "./Checkout.css";
import { Link, useNavigate } from "react-router-dom";
import { customerApi } from "../api/customer";
import { useCart } from "../contexts/CartContext";
import { formatPaymentMethod, formatVnd } from "../utils/format";
import Skeleton from "../components/ui/Skeleton";

function RadioCard({ name, value, checked, disabled, onChange, title, subtitle, right }) {
  return (
    <label
      className={"radio-card " + (checked ? "is-checked" : "")}
      style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} />
      <div className="radio-content">
        <div className="radio-dot" aria-hidden="true" />
        <div className="radio-main">
          <div className="radio-title">{title}</div>
          {subtitle ? <div className="radio-subtitle">{subtitle}</div> : null}
        </div>
        {right ? <div className="radio-right">{right}</div> : null}
      </div>
    </label>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();

  const [addrLoading, setAddrLoading] = useState(true);
  const [addrError, setAddrError] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressMode, setAddressMode] = useState("saved"); // saved | manual
  const [addressId, setAddressId] = useState("");
  const [shippingForm, setShippingForm] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    ward: "",
    district: "",
    city: "",
    province: "",
    country: "VN",
    postalCode: "",
  });

  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [draftCode, setDraftCode] = useState("");
  const [draft, setDraft] = useState(null);

  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [vouchersError, setVouchersError] = useState(null);
  const [vouchers, setVouchers] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [note, setNote] = useState("");

  const [savingNote, setSavingNote] = useState(false);
  const [updatingShipping, setUpdatingShipping] = useState(null); // shopId
  const [updatingVoucher, setUpdatingVoucher] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState(null);

  const cartSignature = useMemo(() => {
    return (items || [])
      .map((it) => `${Number(it.skuId)}:${Number(it.qty)}`)
      .sort()
      .join("|");
  }, [items]);

  const groups = draft?.groups || [];
  const totals = draft?.totals || null;

  const allShippingChosen = useMemo(() => {
    if (!groups.length) return false;
    return groups.every((g) => !!g.selectedOptionCode);
  }, [groups]);

  const canPlaceOrder = !!draftCode && !!draft && allShippingChosen && !placingOrder && !draftLoading;

  // ---------------------------------------------------------------------------
  // Load addresses
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      setAddrLoading(true);
      setAddrError(null);
      try {
        const res = await customerApi.listAddresses();
        if (res?.success) {
          const list = res.data || [];
          setAddresses(list);

          // Default selection
          if (list.length) {
            const def = list.find((a) => a.isDefault) || list[0];
            setAddressMode("saved");
            setAddressId(String(def.id));
          } else {
            setAddressMode("manual");
          }
        } else {
          setAddrError(res?.message || "Không tải được danh sách địa chỉ");
          setAddressMode("manual");
        }
      } catch (e) {
        setAddrError(e?.message || "Không tải được danh sách địa chỉ");
        setAddressMode("manual");
      } finally {
        setAddrLoading(false);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Create draft automatically (saved address)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!items?.length) return;
    if (addressMode !== "saved") return;
    if (!addressId) return;

    // Rebuild draft when cart changes or address changes
    (async () => {
      await createDraft({ addressId: Number(addressId) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, addressId, addressMode]);

  // ---------------------------------------------------------------------------
  // When draft changes, sync note
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setNote(draft?.draft?.note || "");
  }, [draft?.draft?.note]);

  // ---------------------------------------------------------------------------
  // Fetch vouchers when have draftCode
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!draftCode) return;
    refreshVouchers(draftCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCode]);

  async function createDraft({ addressId: addrId, manualShipping } = {}) {
    setDraftLoading(true);
    setDraftError(null);
    setOrderError(null);

    try {
      const payload = {
        items: (items || []).map((it) => ({
          skuId: Number(it.skuId),
          qty: Number(it.qty),
        })),
        addressId: addrId || undefined,
        shipping: manualShipping || undefined,
      };

      const res = await customerApi.createCheckoutDraft(payload);
      if (!res?.success) {
        setDraftError(res?.message || "Không tạo được đơn nháp");
        setDraft(null);
        setDraftCode("");
        return;
      }

      setDraft(res.data);
      setDraftCode(res.data.draftCode);
    } catch (e) {
      setDraftError(e?.message || "Không tạo được đơn nháp");
      setDraft(null);
      setDraftCode("");
    } finally {
      setDraftLoading(false);
    }
  }

  async function refreshDraft(code = draftCode) {
    if (!code) return;
    const res = await customerApi.getCheckoutDraft(code);
    if (res?.success) {
      setDraft(res.data);
    }
  }

  async function refreshVouchers(code = draftCode) {
    if (!code) return;
    setVouchersLoading(true);
    setVouchersError(null);
    try {
      const res = await customerApi.getCheckoutDraftVouchers(code);
      if (res?.success) setVouchers(res.data);
      else setVouchersError(res?.message || "Không tải được voucher");
    } catch (e) {
      setVouchersError(e?.message || "Không tải được voucher");
    } finally {
      setVouchersLoading(false);
    }
  }

  async function onApplyManualShipping() {
    setOrderError(null);
    // basic validation
    if (!shippingForm.fullName || !shippingForm.phone || !shippingForm.line1) {
      setDraftError("Vui lòng nhập Họ tên, SĐT và Địa chỉ (dòng 1) để tính phí giao hàng.");
      return;
    }
    const manual = {
      fullName: String(shippingForm.fullName || "").trim(),
      phone: String(shippingForm.phone || "").trim(),
      line1: String(shippingForm.line1 || "").trim(),
      line2: shippingForm.line2 ? String(shippingForm.line2).trim() : undefined,
      ward: shippingForm.ward ? String(shippingForm.ward).trim() : undefined,
      district: shippingForm.district ? String(shippingForm.district).trim() : undefined,
      city: shippingForm.city ? String(shippingForm.city).trim() : undefined,
      province: shippingForm.province ? String(shippingForm.province).trim() : undefined,
      country: shippingForm.country ? String(shippingForm.country).trim() : "VN",
      postalCode: shippingForm.postalCode ? String(shippingForm.postalCode).trim() : undefined,
    };

    await createDraft({ manualShipping: manual });
  }

  async function selectShipping(shopId, optionCode) {
    if (!draftCode) return;
    setUpdatingShipping(shopId);
    setOrderError(null);
    try {
      const res = await customerApi.updateCheckoutDraftShipping(draftCode, { shopId, optionCode });
      if (!res?.success) throw new Error(res?.message || "Không cập nhật giao hàng");
      await refreshDraft(draftCode);
      await refreshVouchers(draftCode);
    } catch (e) {
      setOrderError(e?.message || "Không cập nhật giao hàng");
    } finally {
      setUpdatingShipping(null);
    }
  }

  async function applyPlatformVoucher(code) {
    if (!draftCode) return;
    setUpdatingVoucher(true);
    setOrderError(null);
    try {
      const res = await customerApi.updateCheckoutDraftVoucher(draftCode, code || null);
      if (!res?.success) throw new Error(res?.message || "Không áp dụng voucher");
      await refreshDraft(draftCode);
      await refreshVouchers(draftCode);
    } catch (e) {
      setOrderError(e?.message || "Không áp dụng voucher");
    } finally {
      setUpdatingVoucher(false);
    }
  }

  async function applyShopVoucher(shopId, code) {
    if (!draftCode) return;
    setUpdatingVoucher(true);
    setOrderError(null);
    try {
      const res = await customerApi.updateCheckoutDraftShopVoucher(draftCode, Number(shopId), code || null);
      if (!res?.success) throw new Error(res?.message || "Không áp dụng voucher shop");
      await refreshDraft(draftCode);
      await refreshVouchers(draftCode);
    } catch (e) {
      setOrderError(e?.message || "Không áp dụng voucher shop");
    } finally {
      setUpdatingVoucher(false);
    }
  }

  async function saveDraftNote() {
    if (!draftCode) return;
    setSavingNote(true);
    setOrderError(null);
    try {
      const res = await customerApi.updateCheckoutDraftNote(draftCode, note);
      if (!res?.success) throw new Error(res?.message || "Không lưu ghi chú");
      await refreshDraft(draftCode);
    } catch (e) {
      setOrderError(e?.message || "Không lưu ghi chú");
    } finally {
      setSavingNote(false);
    }
  }

  async function placeOrder() {
    if (!canPlaceOrder) return;
    setPlacingOrder(true);
    setOrderError(null);
    try {
      const idem = `${draftCode}:${draft?.draft?.updatedAt || "0"}:${paymentMethod}`;
      const res = await customerApi.commitCheckout(
        { draftCode, paymentMethod },
        { idempotencyKey: idem }
      );

      if (!res?.success) throw new Error(res?.message || "Không thể đặt hàng");

      // Clear cart (local) and go to orders page
      clear();
      navigate("/orders", {
        state: {
          justOrdered: true,
          groupCode: res?.data?.groupCode,
          orders: res?.data?.orders || [],
        },
      });
    } catch (e) {
      setOrderError(e?.message || "Không thể đặt hàng");
    } finally {
      setPlacingOrder(false);
    }
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------
  if (!items?.length) {
    return (
      <div className="checkout-page">
        <div className="container-page checkout-page__container">
          <div className="card checkout-empty">
            <div className="checkout-empty__title">Giỏ hàng trống</div>
            <p className="muted checkout-empty__desc">Hãy thêm sản phẩm trước khi thanh toán.</p>
            <div className="checkout-empty__actions">
              <Link to="/products" className="btn-primary">Đi mua sắm</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const platform = vouchers?.platform || null;
  const shopVoucherByShopId = new Map((vouchers?.shops || []).map((s) => [Number(s.shopId), s]));

  return (
    <div className="checkout-page">
      <div className="container-page checkout-page__container">
        <div className="checkout-page__header">
          <div>
            <h1 className="checkout-page__title">Thanh toán</h1>
            <p className="muted checkout-page__subtitle">Chọn địa chỉ, giao hàng, voucher và phương thức thanh toán.</p>
          </div>
          <Link to="/cart" className="btn-secondary">Quay lại giỏ hàng</Link>
        </div>

        {draftError ? <div className="alert alert--error checkout-page__alert">{draftError}</div> : null}
        {orderError ? <div className="alert alert--error checkout-page__alert">{orderError}</div> : null}

        <div className="layout-aside-360 checkout-page__layout">
          {/* LEFT */}
          <div className="checkout-stack checkout-stack--lg">
            {/* Address */}
            <section className="card checkout-section">
              <div className="checkout-section__head">
                <div>
                  <div className="checkout-section__title">Địa chỉ nhận hàng</div>
                  <div className="muted checkout-section__subtitle">Dùng địa chỉ đã lưu hoặc nhập địa chỉ mới.</div>
                </div>
                <Link className="btn-ghost" to="/profile">Quản lý địa chỉ</Link>
              </div>

              {addrLoading ? (
                <div className="checkout-section__content checkout-stack checkout-stack--sm">
                  <Skeleton className="checkout-skel checkout-skel--chip" />
                  <Skeleton className="checkout-skel checkout-skel--row" />
                  <Skeleton className="checkout-skel checkout-skel--row" />
                </div>
              ) : addrError ? (
                <div className="checkout-section__content checkout-section__error">{addrError}</div>
              ) : (
                <div className="checkout-section__content checkout-stack checkout-stack--sm">
                  <div className="checkout-grid checkout-grid--2">
                    <RadioCard
                      name="addrMode"
                      value="saved"
                      checked={addressMode === "saved"}
                      disabled={!addresses.length}
                      onChange={() => setAddressMode("saved")}
                      title="Địa chỉ đã lưu"
                      subtitle={addresses.length ? `${addresses.length} địa chỉ` : "Chưa có địa chỉ"}
                    />
                    <RadioCard
                      name="addrMode"
                      value="manual"
                      checked={addressMode === "manual"}
                      onChange={() => setAddressMode("manual")}
                      title="Nhập địa chỉ mới"
                      subtitle="Dùng cho lần giao hàng này"
                    />
                  </div>

                  {addressMode === "saved" ? (
                    <div className="checkout-section__subContent">
                      <div className="label">Chọn địa chỉ</div>
                      <select className="select" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fullName} ({a.phone}) — {a.line1}{a.ward ? `, ${a.ward}` : ""}{a.district ? `, ${a.district}` : ""}{a.city ? `, ${a.city}` : ""}
                            {a.isDefault ? " • Mặc định" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="checkout-section__subContent checkout-stack checkout-stack--sm">
                      <div className="checkout-grid checkout-grid--2">
                        <div>
                          <div className="label">Họ tên</div>
                          <input className="input" value={shippingForm.fullName} onChange={(e) => setShippingForm({ ...shippingForm, fullName: e.target.value })} />
                        </div>
                        <div>
                          <div className="label">Số điện thoại</div>
                          <input className="input" value={shippingForm.phone} onChange={(e) => setShippingForm({ ...shippingForm, phone: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <div className="label">Địa chỉ (dòng 1)</div>
                        <input className="input" value={shippingForm.line1} onChange={(e) => setShippingForm({ ...shippingForm, line1: e.target.value })} />
                      </div>
                      <div>
                        <div className="label">Địa chỉ (dòng 2)</div>
                        <input className="input" value={shippingForm.line2} onChange={(e) => setShippingForm({ ...shippingForm, line2: e.target.value })} />
                      </div>
                      <div className="checkout-grid checkout-grid--3">
                        <div>
                          <div className="label">Phường/Xã</div>
                          <input className="input" value={shippingForm.ward} onChange={(e) => setShippingForm({ ...shippingForm, ward: e.target.value })} />
                        </div>
                        <div>
                          <div className="label">Quận/Huyện</div>
                          <input className="input" value={shippingForm.district} onChange={(e) => setShippingForm({ ...shippingForm, district: e.target.value })} />
                        </div>
                        <div>
                          <div className="label">Tỉnh/TP</div>
                          <input className="input" value={shippingForm.city} onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })} />
                        </div>
                      </div>

                      <div className="checkout-manualShip">
                        <button className="btn-primary" onClick={onApplyManualShipping} disabled={draftLoading}>
                          {draftLoading ? "Đang tính phí..." : "Tính phí & cập nhật đơn"}
                        </button>
                        <div className="checkout-manualShip__hint muted">Sau khi nhập địa chỉ, bấm để hệ thống tính phí vận chuyển.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Shipping by shop */}
            <section className="card checkout-section">
              <div className="checkout-section__title">Giao hàng theo shop</div>
              <div className="muted checkout-section__subtitle">Mỗi shop có lựa chọn vận chuyển riêng (phí/ETA/giới hạn).</div>

              {draftLoading ? (
                <div className="checkout-section__content checkout-stack checkout-stack--md">
                  <Skeleton className="checkout-skel checkout-skel--title" />
                  <Skeleton className="checkout-skel checkout-skel--block" />
                  <Skeleton className="checkout-skel checkout-skel--block" />
                </div>
              ) : !draftCode ? (
                <div className="checkout-section__placeholder muted">
                  {addressMode === "manual" ? "Nhập địa chỉ và bấm “Tính phí & cập nhật đơn” để xem lựa chọn giao hàng." : "Đang tạo đơn nháp..."}
                </div>
              ) : groups.length ? (
                <div className="checkout-section__content checkout-stack checkout-stack--md">
                  {groups.map((g) => (
                    <div key={g.shopId} className="checkout-shopCard">
                      <div className="checkout-section__head">
                        <div>
                          <div className="checkout-shopCard__title">{g.shop?.name || `Shop #${g.shopId}`}</div>
                          <div className="muted checkout-section__subtitle">
                            {g.items?.length || 0} sản phẩm • Tạm tính: <b>{formatVnd(g.subtotal)}</b>
                          </div>
                          {g.shopDiscount ? (
                            <div className="checkout-shopCard__voucher">Voucher shop: -{formatVnd(g.shopDiscount)}</div>
                          ) : null}
                        </div>
                        <div className="checkout-shopCard__status">
                          {g.selectedOptionCode ? (
                            <span className="badge">Đã chọn</span>
                          ) : (
                            <span className="badge">Chưa chọn</span>
                          )}
                        </div>
                      </div>

                      <div className="checkout-shopCard__options">
                        {(g.shippingOptions || []).length ? (
                          (g.shippingOptions || []).map((opt) => {
                            const checked = g.selectedOptionCode === opt.optionId;
                            const disabled = updatingShipping === g.shopId && !checked;
                            return (
                              <RadioCard
                                key={opt.optionId}
                                name={`ship-${g.shopId}`}
                                value={opt.optionId}
                                checked={checked}
                                disabled={disabled}
                                onChange={() => selectShipping(g.shopId, opt.optionId)}
                                title={`${opt.carrier} • ${opt.serviceName}`}
                                subtitle={
                                  opt.eta?.minDays != null
                                    ? `ETA ${opt.eta.minDays}–${opt.eta.maxDays} ngày • ${opt.description || ""}`.trim()
                                    : (opt.description || "")
                                }
                                right={<div className="checkout-shopCard__fee">{formatVnd(opt.fee)}</div>}
                              />
                            );
                          })
                        ) : (
                          <div className="checkout-shopCard__error">
                            Shop này hiện không có dịch vụ giao hàng khả dụng (out-of-service hoặc cấu hình chưa đúng).
                          </div>
                        )}
                      </div>

                      {g.errorCode ? (
                        <div className="checkout-shopCard__error">
                          Lỗi giao hàng: <b>{g.errorCode}</b> {g.errorMessage ? `— ${g.errorMessage}` : ""}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="checkout-section__placeholder muted">Không có nhóm shop trong đơn nháp.</div>
              )}
            </section>

            {/* Voucher */}
            <section className="card checkout-section">
              <div className="checkout-section__head">
                <div>
                  <div className="checkout-section__title">Voucher</div>
                  <div className="muted checkout-section__subtitle">Chỉ hiện voucher khả dụng theo điều kiện đơn hàng và lịch sử mua.</div>
                </div>
                {updatingVoucher ? <span className="badge">Đang cập nhật...</span> : null}
              </div>

              {!draftCode ? (
                <div className="checkout-section__placeholder muted">Tạo đơn nháp để xem voucher.</div>
              ) : vouchersLoading ? (
                <div className="checkout-section__content checkout-stack checkout-stack--sm">
                  <Skeleton className="checkout-skel checkout-skel--row" />
                  <Skeleton className="checkout-skel checkout-skel--row" />
                  <Skeleton className="checkout-skel checkout-skel--row" />
                </div>
              ) : vouchersError ? (
                <div className="checkout-section__content checkout-section__error">{vouchersError}</div>
              ) : (
                <div className="checkout-voucher">
                  {/* Platform */}
                  <div>
                    <div className="label">Voucher sàn</div>
                    <select
                      className="select"
                      value={platform?.selectedCode || ""}
                      onChange={(e) => applyPlatformVoucher(e.target.value)}
                    >
                      <option value="">Không dùng voucher</option>
                      <optgroup label="Khả dụng">
                        {(platform?.vouchers || [])
                          .filter((v) => v.eligible)
                          .map((v) => (
                            <option key={v.id} value={v.code}>
                              {v.code} • Giảm {v.type === "PERCENT" ? `${v.value}%` : formatVnd(v.value)}
                              {v.minSubtotal ? ` • ĐH từ ${formatVnd(v.minSubtotal)}` : ""}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Không khả dụng">
                        {(platform?.vouchers || [])
                          .filter((v) => !v.eligible)
                          .slice(0, 20)
                          .map((v) => (
                            <option key={v.id} value={v.code} disabled>
                              {v.code} • {v.reason || "Không đủ điều kiện"}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    <div className="checkout-voucher__hint muted">
                      Tạm tính sàn: <b>{formatVnd(platform?.baseSubtotal || 0)}</b>
                    </div>
                  </div>

                  {/* Shop vouchers */}
                  <div className="checkout-voucher__shops">
                    <div className="checkout-section__title">Voucher shop</div>
                    {groups.map((g) => {
                      const shopV = shopVoucherByShopId.get(Number(g.shopId)) || null;
                      const list = shopV?.vouchers || [];
                      return (
                        <div key={g.shopId} className="checkout-shopCard">
                          <div className="checkout-shopVoucherCard__title">{g.shop?.name || `Shop #${g.shopId}`}</div>
                          <div className="checkout-shopVoucherCard__meta muted">Tạm tính shop: {formatVnd(shopV?.baseSubtotal || g.subtotal || 0)}</div>

                          <div className="checkout-section__subContent">
                            <select
                              className="select"
                              value={shopV?.selectedCode || ""}
                              onChange={(e) => applyShopVoucher(g.shopId, e.target.value)}
                            >
                              <option value="">Không dùng voucher</option>
                              <optgroup label="Khả dụng">
                                {list.filter((v) => v.eligible).map((v) => (
                                  <option key={v.id} value={v.code}>
                                    {v.code} • Giảm {v.type === "PERCENT" ? `${v.value}%` : formatVnd(v.value)}
                                    {v.minSubtotal ? ` • ĐH từ ${formatVnd(v.minSubtotal)}` : ""}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Không khả dụng">
                                {list
                                  .filter((v) => !v.eligible)
                                  .slice(0, 20)
                                  .map((v) => (
                                    <option key={v.id} value={v.code} disabled>
                                      {v.code} • {v.reason || "Không đủ điều kiện"}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Payment */}
            <section className="card checkout-section">
              <div className="checkout-section__title">Phương thức thanh toán</div>
              <div className="muted checkout-section__subtitle">Chọn cách bạn muốn thanh toán cho đơn hàng.</div>

              <div className="checkout-grid checkout-grid--pay">
                <RadioCard
                  name="pay"
                  value="COD"
                  checked={paymentMethod === "COD"}
                  onChange={() => setPaymentMethod("COD")}
                  title={formatPaymentMethod("COD")}
                  subtitle="Thanh toán tiền mặt khi nhận hàng"
                />
                <RadioCard
                  name="pay"
                  value="BANK_TRANSFER"
                  checked={paymentMethod === "BANK_TRANSFER"}
                  onChange={() => setPaymentMethod("BANK_TRANSFER")}
                  title={formatPaymentMethod("BANK_TRANSFER")}
                  subtitle="Demo: hệ thống tự ghi nhận thanh toán"
                />
              </div>

              <div className="checkout-section__content">
                <div className="label">Ghi chú cho đơn hàng (tuỳ chọn)</div>
                <textarea
                  className="textarea"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao..."
                />
                <div className="checkout-noteActions">
                  <button className="btn-secondary" onClick={saveDraftNote} disabled={!draftCode || savingNote}>
                    {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
                  </button>
                  <div className="checkout-noteActions__hint muted">Ghi chú sẽ áp dụng cho toàn bộ đơn (mọi shop).</div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: Summary */}
          <aside className="card checkout-summary">
            <div className="checkout-section__title">Tóm tắt</div>

            {!draftCode ? (
              <div className="checkout-section__placeholder muted">Đang chuẩn bị đơn hàng...</div>
            ) : draftLoading ? (
              <div className="checkout-section__content checkout-stack checkout-stack--sm">
                <Skeleton className="checkout-skel checkout-skel--line" />
                <Skeleton className="checkout-skel checkout-skel--line checkout-skel--lineShort" />
                <Skeleton className="checkout-skel checkout-skel--row" />
              </div>
            ) : (
              <div className="checkout-summary__content">
                <div className="checkout-summary__row">
                  <span className="muted">Tạm tính</span>
                  <b>{formatVnd(totals?.subtotal ?? subtotal)}</b>
                </div>
                <div className="checkout-summary__row">
                  <span className="muted">Phí vận chuyển</span>
                  <b>{formatVnd(totals?.shippingTotal ?? 0)}</b>
                </div>
                <div className="checkout-summary__row">
                  <span className="muted">Giảm giá</span>
                  <b className="checkout-summary__discount">- {formatVnd(totals?.discountTotal ?? 0)}</b>
                </div>

                <div className="checkout-summary__totalRow">
                  <span className="checkout-shopCard__title">Tổng</span>
                  <span className="checkout-summary__totalValue">{formatVnd(totals?.total ?? 0)}</span>
                </div>

                {!allShippingChosen ? (
                  <div className="checkout-summary__info alert alert--info">
                    Vui lòng chọn <b>dịch vụ giao hàng</b> cho tất cả shop trước khi đặt hàng.
                  </div>
                ) : null}

                <button className="btn-primary checkout-summary__btn" disabled={!canPlaceOrder} onClick={placeOrder}>
                  {placingOrder ? "Đang đặt hàng..." : "Đặt hàng"}
                </button>

                <div className="checkout-summary__draft muted">
                  Mã draft: <b>{draftCode}</b>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
