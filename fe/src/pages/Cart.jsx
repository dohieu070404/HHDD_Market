import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

export default function Cart() {
  const { items, subtotal, removeItem, setQty } = useCart();
  const { token } = useAuth();
  const navigate = useNavigate();

  function goCheckout() {
    if (!token) {
      navigate("/login?next=" + encodeURIComponent("/checkout"));
      return;
    }
    navigate("/checkout");
  }

  if (!items.length) {
    return (
      <div className="container-page py-10">
        <div className="card p-6">
          <div className="text-lg font-semibold">Giỏ hàng trống</div>
          <p className="mt-1 muted">Hãy thêm vài sản phẩm trước khi thanh toán.</p>
          <div className="mt-4">
            <Link to="/products" className="btn-primary">Đi mua sắm</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-xl font-semibold">Giỏ hàng</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card p-4">
          <div className="divide-y divide-slate-200">
            {items.map((it) => (
              <div key={it.skuId} className="flex gap-4 py-4">
                <div className="h-20 w-20 overflow-hidden rounded-lg bg-slate-100">
                  <img
                    src={it.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=320&auto=format&fit=crop"}
                    alt={it.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="muted text-sm">SKU: {it.skuName || "Mặc định"}</div>
                      {it.shop?.name ? <div className="muted text-xs">{it.shop.name}</div> : null}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatVND(it.price)}</div>
                      <div className="muted text-xs">/ 1 sp</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">SL</span>
                      <input
                        className="input w-24"
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => setQty(it.skuId, e.target.value)}
                      />
                    </div>
                    <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={() => removeItem(it.skuId)}>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card p-6 h-fit">
          <div className="text-sm font-semibold">Tóm tắt</div>
          <div className="mt-3 flex items-center justify-between">
            <span className="muted">Tạm tính</span>
            <span className="font-semibold">{formatVND(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="muted">Phí ship</span>
            <span className="muted">Tính ở bước checkout</span>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4 flex items-center justify-between">
            <span className="font-medium">Tổng</span>
            <span className="text-lg font-semibold">{formatVND(subtotal)}</span>
          </div>
          <button className="btn-primary mt-5 w-full" onClick={goCheckout}>
            Thanh toán
          </button>
          <Link to="/products" className="btn-secondary mt-3 w-full">
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </div>
  );
}
