import { useNavigate } from "react-router-dom";
import "./ProductCard.css";
import RatingStars from "../ui/RatingStars";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function ShopInline({ shop, onNavigate }) {
  if (!shop) return null;
  return (
    <button
      type="button"
      className="shop-inline"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate(`/shop/${shop.slug}`);
      }}
      title={shop.name}
    >
      <span className="shop-inline__avatar">
        {shop.logoUrl ? (
          <img src={shop.logoUrl} alt={shop.name} />
        ) : (
          <span>{(shop.name || "S").slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="shop-inline__name">{shop.name}</span>
    </button>
  );
}

export default function ProductCard({ product, compact = false }) {
  const navigate = useNavigate();
  const img =
    product.thumbnailUrl ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&auto=format&fit=crop";

  const goProduct = () => navigate(`/p/${encodeURIComponent(product.slug)}`);

  return (
    <div
      className={compact ? "card product-card product-card--compact" : "card product-card"}
      role="link"
      tabIndex={0}
      onClick={goProduct}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goProduct();
        }
      }}
    >
      <div className="product-card__media" aria-hidden>
        <img src={img} alt={product.name} className="product-card__img" loading="lazy" />
      </div>
      <div className="product-card__body">
        <div className="product-card__name">{product.name}</div>

        <div className="product-card__priceRow">
          <div className="product-card__price">{formatVND(product.price)}</div>
          {product.compareAtPrice ? (
            <div className="product-card__compare">{formatVND(product.compareAtPrice)}</div>
          ) : null}
        </div>

        <div className="product-card__metaRow">
          <div className="product-card__rating">
            <RatingStars value={product.ratingAvg || 0} />
            <span className="product-card__ratingCount muted">({product.ratingCount || 0})</span>
          </div>
          <div className="product-card__sold muted">Đã bán {product.soldCount || 0}</div>
        </div>

        {!compact ? (
          <div className="product-card__shop">
            <ShopInline shop={product.shop} onNavigate={navigate} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
