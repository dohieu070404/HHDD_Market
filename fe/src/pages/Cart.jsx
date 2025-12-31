import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Cart.css";
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
  const location = useLocation();
  const reorderInfo = location.state?.added != null ? { added: location.state.added, skipped: location.state.skipped || 0 } : null;

  function goCheckout() {
    if (!token) {
      navigate("/login?next=" + encodeURIComponent("/checkout"));
      return;
    }
    navigate("/checkout");
  }

  if (!items.length) {
    return (
      <div className="cart-page">
        <div className="container-page cart-page__container">
          <div className="card cart-empty">
            <div className="cart-empty__title">Giỏ hàng trống</div>
            <p className="muted cart-empty__desc">Hãy thêm vài sản phẩm trước khi thanh toán.</p>
            <div className="cart-empty__actions">
              <Link to="/products" className="btn-primary">Đi mua sắm</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container-page cart-page__container">
        <h1 className="cart-page__title">Giỏ hàng</h1>

      {reorderInfo ? (
        <div className="alert alert--success cart-page__alert">
          Đã thêm <b>{reorderInfo.added}</b> sản phẩm vào giỏ hàng.
          {reorderInfo.skipped ? <span className="muted"> (Bỏ qua {reorderInfo.skipped} sản phẩm không còn bán / hết hàng)</span> : null}
        </div>
      ) : null}

      <div className="layout-aside-360 cart-page__layout">
        <section className="card cart-list">
            {items.map((it) => (
              <div key={it.skuId} className="cart-item">
                <div className="cart-item__thumb">
                  <img
                    src={it.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=320&auto=format&fit=crop"}
                    alt={it.name}
                    className="cart-item__thumbImg"
                  />
                </div>
                <div className="cart-item__main">
                  <div className="cart-item__head">
                    <div>
                      <div className="cart-item__name">{it.name}</div>
                      <div className="muted cart-item__sku">SKU: {it.skuName || "Mặc định"}</div>
                      {it.shop?.name ? <div className="muted cart-item__shop">{it.shop.name}</div> : null}
                    </div>
                    <div className="cart-item__price">
                      <div className="cart-item__priceValue">{formatVND(it.price)}</div>
                      <div className="muted cart-item__priceUnit">/ 1 sp</div>
                    </div>
                  </div>

                  <div className="cart-item__footer">
                    <div className="cart-item__qty">
                      <span className="cart-item__qtyLabel">SL</span>
                      <input
                        className="input cart-item__qtyInput"
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => setQty(it.skuId, e.target.value)}
                      />
                    </div>
                    <button className="btn-ghost btn-ghost--danger cart-item__remove" onClick={() => removeItem(it.skuId)}>
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </section>

        <aside className="card cart-summary">
          <div className="cart-summary__title">Tóm tắt</div>
          <div className="cart-summary__row">
            <span className="muted">Tạm tính</span>
            <span className="cart-summary__value">{formatVND(subtotal)}</span>
          </div>
          <div className="cart-summary__row">
            <span className="muted">Phí ship</span>
            <span className="muted">Tính ở bước checkout</span>
          </div>
          <div className="cart-summary__total">
            <span className="cart-summary__totalLabel">Tổng</span>
            <span className="cart-summary__totalValue">{formatVND(subtotal)}</span>
          </div>
          <button className="btn-primary cart-summary__checkout" onClick={goCheckout}>
            Thanh toán
          </button>
          <Link to="/products" className="btn-secondary cart-summary__continue">
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
      </div>
    </div>
  );
}
