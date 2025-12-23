import { Link } from "react-router-dom";
import RatingStars from "../ui/RatingStars";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

export default function ProductCard({ product }) {
  const img = product.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=640&auto=format&fit=crop";

  return (
    <Link to={`/p/${encodeURIComponent(product.slug)}`} className="card overflow-hidden hover:border-slate-300">
      <div className="aspect-[4/3] bg-slate-100">
        <img src={img} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-4">
        <div className="line-clamp-2 text-sm font-medium leading-snug">{product.name}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-base font-semibold text-slate-900">{formatVND(product.price)}</div>
          {product.compareAtPrice ? (
            <div className="text-xs text-slate-400 line-through">{formatVND(product.compareAtPrice)}</div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <RatingStars value={product.ratingAvg || 0} />
            <span className="muted">({product.ratingCount || 0})</span>
          </div>
          <div className="muted">Đã bán {product.soldCount || 0}</div>
        </div>

        <div className="mt-2 text-xs text-slate-500">{product.shop?.name || ""}</div>
      </div>
    </Link>
  );
}
