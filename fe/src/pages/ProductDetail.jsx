import { useEffect, useMemo, useState } from "react";
import "./ProductDetail.css";
import { Link, useParams } from "react-router-dom";
import { publicApi } from "../api/public";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useToast } from "../contexts/ToastContext";
import RatingStars from "../components/ui/RatingStars";
import ProductCard from "../components/product/ProductCard";
import { formatVnd, formatDateTime } from "../utils/format";

export default function ProductDetail() {
  const { slug } = useParams();
  const { token } = useAuth();
  const { addItem } = useCart();
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);

  const [selectedSkuId, setSelectedSkuId] = useState(null);
  const [qty, setQty] = useState(1);

  const [reviewPage, setReviewPage] = useState(1);
  const [reviews, setReviews] = useState({ items: [], pagination: { page: 1, totalPages: 1 } });

  const [similar, setSimilar] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);

  const selectedSku = useMemo(() => {
    if (!product?.skus?.length) return null;
    return product.skus.find((s) => Number(s.id) === Number(selectedSkuId)) || product.skus[0];
  }, [product, selectedSkuId]);

  const availableStock = selectedSku?.stock ?? 0;
  const displayPrice = selectedSku?.price ?? product?.price ?? 0;
  const compareAtPrice = selectedSku?.compareAtPrice ?? product?.compareAtPrice ?? null;

  async function load() {
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
    } catch (e) {
      setError(e?.data?.message || "Không tải được sản phẩm");
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

  async function loadSimilar() {
    setSimilarLoading(true);
    try {
      const res = await publicApi.similarProducts(slug, { limit: 8 });
      if (res?.success) setSimilar(res.data || []);
    } finally {
      setSimilarLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (product?.id) {
      loadReviews(1);
      loadSimilar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  function onAddToCart() {
    if (!product || !selectedSku) return;

    if (availableStock <= 0) {
      push({ type: "error", title: "Không thể thêm", message: "Sản phẩm hiện đã hết hàng" });
      return;
    }
    const safeQty = Math.max(1, Math.min(Number(qty || 1), availableStock));
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
      safeQty
    );
    push({ type: "success", title: "Thành công", message: "Đã thêm vào giỏ hàng" });
  }

  if (loading) {
    return (
      <div className="product-page">
        <div className="container-page">
          <div className="card product-loadingCard">Đang tải sản phẩm…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-page">
        <div className="container-page">
          <div className="alert alert--error product-page__alert">{error}</div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="product-page">
      <div className="container-page">
        <div className="product-layout">
          {/* Left */}
          <div className="card product-mainCard">
            <div className="product-mainCard__grid">
              <div className="product-gallery">
                <div className="product-media">
                  <img
                    src={product.thumbnailUrl || "/placeholder.png"}
                    alt={product.name}
                    className="product-media__img"
                  />
                </div>

                {product.shop ? (
                  <div className="product-shopMini">
                    <div className="product-shopMini__left">
                      <div className="product-shopMini__avatar">
                        <img
                          src={product.shop.logoUrl || "/placeholder.png"}
                          alt={product.shop.name}
                          className="product-shopMini__img"
                        />
                      </div>
                      <div className="product-shopMini__meta">
                        <div className="product-shopMini__name">{product.shop.name}</div>
                        <div className="product-shopMini__slug muted">@{product.shop.slug}</div>
                      </div>
                    </div>
                    <Link to={`/shop/${product.shop.slug}`} className="btn btn-outline btn-sm">
                      Xem shop
                    </Link>
                  </div>
                ) : null}
              </div>

              <div className="product-info">
                <h1 className="product-title">{product.name}</h1>

                <div className="product-meta">
                  <RatingStars value={product.ratingAvg || 0} />
                  <span className="muted">
                    {(product.ratingAvg || 0).toFixed(1)} ({product.ratingCount || 0} đánh giá)
                  </span>
                  <span className="product-meta__dot">•</span>
                  <span className="muted">Đã bán {product.soldCount || 0}</span>
                </div>

                <div className="product-priceRow">
                  <div className="product-priceRow__price">{formatVnd(displayPrice)}</div>
                  {compareAtPrice ? (
                    <div className="product-priceRow__compare muted">{formatVnd(compareAtPrice)}</div>
                  ) : null}
                </div>

                {product?.skus?.length > 1 ? (
                  <div className="product-variants">
                    <div className="label product-variants__label">Phân loại</div>
                    <div className="product-variants__list">
                      {product.skus.map((s) => {
                        const active = Number(selectedSku?.id) === Number(s.id);
                        const label = s.name === "Default" ? "Mặc định" : s.name;
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSkuId(s.id)}
                            className={`btn btn-outline btn-sm product-variantBtn ${active ? "is-active" : ""}`}
                            type="button"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="product-qty">
                  <div className="label product-qty__label">Số lượng</div>
                  <div className="product-qty__row">
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => setQty((q) => Math.max(1, Number(q || 1) - 1))}
                    >
                      −
                    </button>
                    <input
                      className="input product-qty__input"
                      type="number"
                      min={1}
                      max={Math.max(1, availableStock)}
                      value={qty}
                      onChange={(e) => setQty(Number(e.target.value))}
                    />
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => setQty((q) => Math.min(Math.max(1, availableStock), Number(q || 1) + 1))}
                    >
                      +
                    </button>
                    <div className="product-qty__stock muted">Còn lại: {availableStock}</div>
                  </div>
                </div>

                <div className="product-add">
                  <button
                    className="btn btn-primary product-add__btn"
                    disabled={availableStock <= 0}
                    onClick={onAddToCart}
                  >
                    {availableStock <= 0 ? "Hết hàng" : "Thêm vào giỏ"}
                  </button>
                </div>

                <div className="product-desc">
                  <h3 className="product-desc__title">Mô tả</h3>
                  <div className="product-desc__content">{product.description || "(Chưa có mô tả)"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="product-aside">
            <section className="card product-asideCard">
              <div className="product-asideCard__header">
                <h2 className="product-asideCard__title">Sản phẩm tương tự</h2>
                <span className="product-asideCard__hint muted">Ưu tiên tên giống → cùng danh mục → nhiều lượt mua</span>
              </div>

              {similarLoading ? (
                <div className="product-asideCard__empty muted">Đang tải gợi ý…</div>
              ) : similar?.length ? (
                <div className="product-similarGrid">
                  {similar.slice(0, 4).map((p) => (
                    <ProductCard key={p.id} product={p} compact />
                  ))}
                </div>
              ) : (
                <div className="product-asideCard__empty muted">Chưa có gợi ý phù hợp.</div>
              )}
            </section>

            <section className="card product-asideCard">
              <h2 className="product-asideCard__title">Đánh giá sản phẩm</h2>
              <p className="product-reviewCta__text muted">
                Việc viết/chỉnh sửa đánh giá được thực hiện tại <b>Trung tâm đánh giá</b> để đảm bảo đúng điều kiện đơn hàng (đã mua/đã nhận hàng).
              </p>
              <div className="product-reviewCta__actions">
                {token ? (
                  <Link
                    to={`/reviews?product=${encodeURIComponent(String(product.id))}`}
                    className="btn btn-primary product-reviewCta__btn"
                  >
                    Đi tới Trung tâm đánh giá
                  </Link>
                ) : (
                  <Link to="/login" className="btn btn-primary product-reviewCta__btn">
                    Đăng nhập để đánh giá
                  </Link>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="card product-reviews">
          <div className="product-reviews__header">
            <h2 className="product-reviews__title">Đánh giá ({product.ratingCount || 0})</h2>
            <div className="product-reviews__rating">
              <RatingStars value={product.ratingAvg || 0} />
              <span className="muted">{(product.ratingAvg || 0).toFixed(1)}</span>
            </div>
          </div>

          <div className="product-reviews__list">
            {(reviews.items || []).length === 0 ? (
              <div className="muted product-reviews__empty">Chưa có đánh giá.</div>
            ) : (
              reviews.items.map((r) => (
                <div key={r.id} className="card product-reviewCard">
                  <div className="product-reviewCard__top">
                    <div className="product-reviewCard__name">{r.user?.name || r.user?.username || "Người dùng"}</div>
                    <div className="product-reviewCard__meta">
                      <RatingStars value={r.rating} />
                      <span className="muted">{formatDateTime(r.createdAt)}</span>
                    </div>
                  </div>

                  {r.content ? <div className="product-reviewCard__content">{r.content}</div> : null}

                  {Array.isArray(r.mediaUrls) && r.mediaUrls.length > 0 ? (
                    <div className="product-reviewCard__gallery">
                      {r.mediaUrls.map((url, idx) => (
                        <a
                          key={`${r.id}-${idx}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="product-reviewCard__galleryItem"
                        >
                          <img
                            src={url}
                            alt={`review-${r.id}-${idx + 1}`}
                            className="product-reviewCard__galleryImg"
                          />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  {r.replies?.length ? (
                    <div className="product-thread">
                      <div className="product-thread__title muted">Phản hồi từ shop</div>
                      {r.replies.map((rp) => (
                        <div key={rp.id} className="product-thread__item">
                          <span className="product-thread__name">{rp.shop?.name || "Shop"}:</span> {rp.content}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {r.buyerFollowUp ? (
                    <div className="product-thread">
                      <div className="product-thread__title muted">Bạn đã cập nhật</div>
                      <div className="product-thread__item">{r.buyerFollowUp.content}</div>
                    </div>
                  ) : null}

                  {r.sellerFollowUp ? (
                    <div className="product-thread">
                      <div className="product-thread__title muted">Shop phản hồi thêm</div>
                      <div className="product-thread__item">{r.sellerFollowUp.content}</div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {reviews.pagination?.totalPages > 1 ? (
            <div className="product-reviews__pager">
              <button className="btn btn-outline btn-sm" disabled={reviewPage <= 1} onClick={() => loadReviews(reviewPage - 1)}>
                ‹ Trước
              </button>
              <div className="muted">
                Trang {reviews.pagination.page}/{reviews.pagination.totalPages}
              </div>
              <button
                className="btn btn-outline btn-sm"
                disabled={reviewPage >= reviews.pagination.totalPages}
                onClick={() => loadReviews(reviewPage + 1)}
              >
                Sau ›
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
