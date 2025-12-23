import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { customerApi } from "../api/customer";
import { useCart } from "../contexts/CartContext";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [voucherCode, setVoucherCode] = useState("");
  const [shipping, setShipping] = useState({ fullName: "", phone: "", addressLine1: "", city: "", district: "", ward: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await customerApi.listAddresses();
        if (res?.success) {
          const list = res.data || [];
          setAddresses(list);
          const def = list.find((a) => a.isDefault) || list[0];
          setSelectedAddressId(def ? def.id : null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const payloadItems = useMemo(() => items.map((it) => ({ skuId: it.skuId, qty: it.qty })), [items]);

  async function placeOrder() {
    if (!items.length) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const body = {
        items: payloadItems,
        paymentMethod,
        voucherCode: voucherCode || undefined,
      };

      if (selectedAddressId) {
        body.addressId = Number(selectedAddressId);
      } else {
        // Validate
        if (!shipping.fullName || !shipping.phone || !shipping.addressLine1 || !shipping.city) {
          setMessage({ type: "error", text: "Vui lòng nhập đầy đủ thông tin giao hàng (Tên, SĐT, Địa chỉ, Thành phố)" });
          return;
        }
        body.shipping = shipping;
      }

      const res = await customerApi.checkout(body);
      if (res?.success) {
        clear();
        const orders = res.data?.orders || [];
        const first = orders[0]?.code;
        setMessage({ type: "success", text: `Đặt hàng thành công${first ? ` (mã: ${first}...)` : ""}.` });
        navigate("/orders", { state: { justOrdered: true, orders } });
      } else {
        setMessage({ type: "error", text: res?.message || "Đặt hàng thất bại" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="container-page py-10">
        <div className="card p-6">
          <div className="text-lg font-semibold">Không có sản phẩm để thanh toán</div>
          <p className="muted mt-1">Hãy thêm sản phẩm vào giỏ hàng.</p>
          <div className="mt-4">
            <Link to="/products" className="btn-primary">Đi mua sắm</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-xl font-semibold">Checkout</h1>
      <p className="muted text-sm">Chọn địa chỉ, phương thức thanh toán và đặt hàng.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-6">
          <div className="text-sm font-semibold">Thông tin giao hàng</div>

          {loading ? (
            <div className="mt-3 muted">Đang tải địa chỉ...</div>
          ) : addresses.length ? (
            <div className="mt-3 space-y-2">
              <div className="text-sm text-slate-600">Chọn địa chỉ đã lưu</div>
              {addresses.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                  <input
                    type="radio"
                    name="addr"
                    checked={Number(selectedAddressId) === Number(a.id)}
                    onChange={() => setSelectedAddressId(a.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">
                      {a.fullName} <span className="muted">({a.phone})</span>
                      {a.isDefault ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">Mặc định</span> : null}
                    </div>
                    <div className="muted text-sm">
                      {a.addressLine1}, {a.ward}, {a.district}, {a.city}
                    </div>
                  </div>
                </label>
              ))}

              <button type="button" className="btn-ghost" onClick={() => setSelectedAddressId(null)}>
                + Nhập địa chỉ khác
              </button>
            </div>
          ) : (
            <div className="mt-3 muted text-sm">Chưa có địa chỉ. Vui lòng nhập địa chỉ mới.</div>
          )}

          {!selectedAddressId ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="label mb-1">Họ và tên</div>
                <input className="input" value={shipping.fullName} onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })} />
              </div>
              <div>
                <div className="label mb-1">Số điện thoại</div>
                <input className="input" value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <div className="label mb-1">Địa chỉ</div>
                <input className="input" value={shipping.addressLine1} onChange={(e) => setShipping({ ...shipping, addressLine1: e.target.value })} />
              </div>
              <div>
                <div className="label mb-1">Thành phố</div>
                <input className="input" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} />
              </div>
              <div>
                <div className="label mb-1">Quận/Huyện</div>
                <input className="input" value={shipping.district} onChange={(e) => setShipping({ ...shipping, district: e.target.value })} />
              </div>
              <div>
                <div className="label mb-1">Phường/Xã</div>
                <input className="input" value={shipping.ward} onChange={(e) => setShipping({ ...shipping, ward: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <div className="label mb-1">Ghi chú</div>
                <input className="input" value={shipping.note} onChange={(e) => setShipping({ ...shipping, note: e.target.value })} />
              </div>
            </div>
          ) : null}

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="text-sm font-semibold">Thanh toán</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="label mb-1">Phương thức</div>
                <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="COD">COD (Thanh toán khi nhận hàng)</option>
                  <option value="BANK_TRANSFER">Chuyển khoản</option>
                  <option value="MOCK_GATEWAY">Mock gateway</option>
                </select>
              </div>
              <div>
                <div className="label mb-1">Voucher</div>
                <input className="input" placeholder="(Tùy chọn)" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} />
              </div>
            </div>
          </div>

          {message ? (
            <div className={"mt-4 text-sm " + (message.type === "error" ? "text-red-600" : "text-emerald-700")}>
              {message.text}
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button className="btn-primary" disabled={submitting} onClick={placeOrder}>
              {submitting ? "Đang đặt hàng..." : "Đặt hàng"}
            </button>
            <Link to="/cart" className="btn-secondary">Quay lại giỏ</Link>
          </div>
        </section>

        <aside className="card p-6 h-fit">
          <div className="text-sm font-semibold">Đơn hàng</div>
          <div className="mt-4 space-y-3">
            {items.map((it) => (
              <div key={it.skuId} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-medium">{it.name}</div>
                  <div className="muted text-xs">{it.skuName || "Mặc định"} × {it.qty}</div>
                </div>
                <div className="font-semibold">{formatVND(it.price * it.qty)}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <span className="muted">Tạm tính</span>
              <span className="font-semibold">{formatVND(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="muted">Phí ship</span>
              <span className="muted">Tạm tính</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-medium">Tổng</span>
              <span className="text-lg font-semibold">{formatVND(subtotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
