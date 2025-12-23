import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { publicApi } from "../api/public";
import { customerApi } from "../api/customer";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import RatingStars from "../components/ui/RatingStars";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { token } = useAuth();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  const [selectedSkuId, setSelectedSkuId] = useState(null);
  const [qty, setQty] = useState(1);

  const [reviewPage, setReviewPage] = useState(1);
  const [reviews, setReviews] = useState({ items: [], pagination: { page: 1, totalPages: 1 } });

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewMsg, setReviewMsg] = useState(null);

  async function loadProduct() {
    setLoading(true);
    try {
      const res = await publicApi.getProduct(slug);
      if (res?.success) {
        setProduct(res.data);
        setSelectedSkuId(res.data?.skus?.[0]?.id || null);
        setError(null);
      } else {
        setError(res?.message || "Không tìm thấy sản phẩm");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadReviews(nextPage = 1) {
    if (!product?.id) return;
    const res = await publicApi.productReviews(product.id, { page: nextPage, limit: 10 });
    if (res?.success) {
      setReviews(res.data);
      setReviewPage(nextPage);
    }
  }

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (product?.id) loadReviews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const selectedSku = useMemo(() => {
    if (!product?.skus?.length) return null;
    return product.skus.find((s) => Number(s.id) === Number(selectedSkuId)) || product.skus[0];
  }, [product, selectedSkuId]);

  const displayPrice = selectedSku?.price ?? product?.price ?? 0;

  function onAddToCart() {
    if (!product || !selectedSku) return;
    if (selectedSku.stock <= 0) {
      setReviewMsg({ type: "error", text: "SKU này đã hết hàng" });
      return;
    }
    addItem(
      {
        skuId: selectedSku.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        skuName: selectedSku.name,
        price: displayPrice,
        thumbnailUrl: product.thumbnailUrl,
        shop: product.shop,
      },
      qty
    );
    setReviewMsg({ type: "success", text: "Đã thêm vào giỏ hàng" });
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!product) return;
    setReviewMsg(null);
    const res = await customerApi.createProductReview(product.id, {
      rating: Number(reviewRating),
      content: reviewContent || null,
      mediaUrls: [],
    });

    if (res?.success) {
      setReviewContent("");
      setReviewRating(5);
      setReviewMsg({ type: "success", text: "Đã gửi đánh giá" });
      await loadProduct();
      await loadReviews(1);
    } else {
      setReviewMsg({ type: "error", text: res?.message || "Không gửi được đánh giá" });
    }
  }

  if (loading) {
    return (
      <div className="container-page py-10">
        <div className="card p-6">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-10">
        <div className="card p-6 text-red-600">{error}</div>
        <div className="mt-4">
          <Link to="/products" className="btn-secondary">Quay lại</Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const img = product.thumbnailUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop";

  return (
    <div className="container-page py-8">
      <Link to="/products" className="text-sm text-slate-600 hover:text-slate-900">← Quay lại danh sách</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-slate-100">
            <img src={img} alt={product.name} className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="card p-6">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <RatingStars value={product.ratingAvg || 0} />
              <span className="muted">({product.ratingCount || 0})</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="muted">Đã bán {product.soldCount || 0}</div>
          </div>

          <div className="mt-4 flex items-end gap-3">
            <div className="text-3xl font-semibold">{formatVND(displayPrice)}</div>
            {product.compareAtPrice ? (
              <div className="text-sm text-slate-400 line-through">{formatVND(product.compareAtPrice)}</div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="label mb-2">Phân loại (SKU)</div>
            <div className="flex flex-wrap gap-2">
              {(product.skus || []).map((sku) => (
                <button
                  key={sku.id}
                  type="button"
                  onClick={() => setSelectedSkuId(sku.id)}
                  className={
                    "rounded-lg border px-3 py-2 text-sm transition " +
                    (Number(selectedSkuId) === Number(sku.id)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50")
                  }
                >
                  {sku.name || "Mặc định"}
                  <span className="ml-2 text-xs opacity-80">({sku.stock} tồn)</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="label">Số lượng</span>
              <input
                className="input w-24"
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
              />
            </div>
            <button className="btn-primary" onClick={onAddToCart}>Thêm vào giỏ</button>
            <Link to="/cart" className="btn-secondary">Xem giỏ hàng</Link>
          </div>

          {reviewMsg ? (
            <div className={"mt-4 text-sm " + (reviewMsg.type === "error" ? "text-red-600" : "text-emerald-700")}
            >
              {reviewMsg.text}
            </div>
          ) : null}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="text-sm font-semibold">Cửa hàng</div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{product.shop?.name || ""}</div>
                <div className="muted text-sm flex items-center gap-2">
                  <RatingStars value={product.shop?.ratingAvg || 0} />
                  <span>({product.shop?.ratingCount || 0})</span>
                </div>
              </div>
              {product.shop?.slug ? (
                <Link to={`/products?shop=${encodeURIComponent(product.shop.slug)}`} className="btn-secondary">Xem shop</Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Mô tả</h2>
          <p className="mt-3 text-slate-700 leading-relaxed whitespace-pre-line">
            {product.description || "(Chưa có mô tả)"}
          </p>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold">Đánh giá</h2>

          {(reviews.items || []).length ? (
            <div className="mt-4 space-y-4">
              {reviews.items.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{r.user?.username || r.user?.name || "User"}</div>
                    <RatingStars value={r.rating} />
                  </div>
                  {r.content ? <div className="mt-2 text-sm text-slate-700 whitespace-pre-line">{r.content}</div> : null}
                  <div className="mt-2 text-xs muted">{new Date(r.createdAt).toLocaleString("vi-VN")}</div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <button
                  className="btn-secondary"
                  disabled={reviews.pagination?.page <= 1}
                  onClick={() => loadReviews(reviewPage - 1)}
                >
                  Trước
                </button>
                <div className="text-sm text-slate-600">
                  Trang {reviews.pagination?.page || 1} / {reviews.pagination?.totalPages || 1}
                </div>
                <button
                  className="btn-secondary"
                  disabled={reviews.pagination?.page >= (reviews.pagination?.totalPages || 1)}
                  onClick={() => loadReviews(reviewPage + 1)}
                >
                  Sau
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 muted text-sm">Chưa có đánh giá.</div>
          )}

          <div className="mt-6 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold">Viết đánh giá</h3>
            {!token ? (
              <div className="mt-2 text-sm text-slate-600">
                Bạn cần <Link to="/login" className="underline">đăng nhập</Link> để đánh giá.
              </div>
            ) : (
              <form onSubmit={submitReview} className="mt-3 space-y-3">
                <div>
                  <div className="label mb-1">Số sao</div>
                  <select className="select" value={reviewRating} onChange={(e) => setReviewRating(e.target.value)}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} sao
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="label mb-1">Nhận xét</div>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Viết cảm nhận của bạn..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                  />
                </div>
                <button className="btn-primary" type="submit">Gửi đánh giá</button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
