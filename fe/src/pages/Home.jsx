import { useEffect, useState } from "react";
import "./Home.css";
import { Link } from "react-router-dom";
import { publicApi } from "../api/public";
import ProductCard from "../components/product/ProductCard";

function ShopCard({ shop }) {
  if (!shop) return null;
  const ratingAvg = Number(shop.ratingAvg || 0);
  const ratingCount = Number(shop.ratingCount || 0);
  return (
    <Link to={`/shop/${shop.slug}`} className="card home-shopCard">
      <div className="home-shopCard__head">
        <div className="home-shopCard__logo">
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt={shop.name} className="home-shopCard__logoImg" />
          ) : (
            <span className="home-shopCard__logoFallback">{(shop.name || "S").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="home-shopCard__meta">
          <div className="home-shopCard__name" title={shop.name}>{shop.name}</div>
          <div className="home-shopCard__rating">
            <span className="home-shopCard__ratingValue">{Number.isFinite(ratingAvg) ? ratingAvg : 0}</span>
            <span className="home-shopCard__ratingSep">/</span>
            <span>5</span>
            <span className="home-shopCard__ratingDot">•</span>
            <span>{Number.isFinite(ratingCount) ? ratingCount.toLocaleString("vi-VN") : 0} đánh giá</span>
          </div>
        </div>
      </div>
      {shop.description ? <div className="home-shopCard__desc muted line-clamp-2">{shop.description}</div> : null}
    </Link>
  );
}

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ categories: [], featured: [], flashSale: [], topShops: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await publicApi.home();
        if (res?.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res?.message || "Không tải được trang chủ");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="container-page home-hero__container">
          <div className="home-hero__grid">
            <div className="home-hero__left">
              <div className="home-hero__badge">
                <span className="home-hero__badgeDot" aria-hidden />
                Marketplace demo (Tiki/Shopee-like)
              </div>

              <h1 className="home-hero__title">ShopEZ — mua sắm nhanh, quản lý bán hàng gọn</h1>
              <p className="home-hero__desc">
                Trải nghiệm luồng đặt hàng, vận chuyển, voucher, đánh giá, khiếu nại và seller center.
                Giao diện được tối ưu theo phong cách sàn (Tiki-like) để dễ dùng hơn.
              </p>

              <div className="home-hero__actions">
                <Link to="/products" className="btn-primary">Khám phá sản phẩm</Link>
                <Link to="/open-shop" className="btn-secondary">Mở shop</Link>
                <Link to="/guide" className="btn-ghost">Hướng dẫn</Link>
              </div>

              <div className="home-hero__pills">
                <span className="home-hero__pill">Voucher</span>
                <span className="home-hero__pill">Trả/Hoàn</span>
                <span className="home-hero__pill">Khiếu nại</span>
                <span className="home-hero__pill">Seller Center</span>
              </div>
            </div>

            <div className="card home-quickStart">
              <div className="home-quickStart__title">Bắt đầu nhanh</div>
              <p className="home-quickStart__desc muted">
                Nếu bạn đã seed DB, hãy đăng nhập tài khoản demo và thử:
                thêm vào giỏ → checkout → theo dõi đơn → đánh giá → khiếu nại.
              </p>
              <div className="home-quickStart__actions">
                <Link to="/login" className="btn-secondary home-quickStart__btn">Đăng nhập</Link>
                <Link to="/register" className="btn-primary home-quickStart__btn">Đăng ký</Link>
              </div>
              <Link to="/guide" className="btn-ghost home-quickStart__more">
                Xem hướng dẫn chi tiết
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page home-section home-section--spacious">
        <div className="home-section__head">
          <h2 className="home-section__title">Danh mục nổi bật</h2>
          <Link to="/products" className="home-section__link">Xem tất cả</Link>
        </div>

        {loading ? (
          <div className="home-grid home-grid--cats">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card home-skeletonCard">
                <div className="skeleton home-skeletonCard__line" />
                <div className="skeleton home-skeletonCard__line home-skeletonCard__line--short" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card home-section__message home-section__message--error">{error}</div>
        ) : (
          <div className="home-grid home-grid--cats">
            {(data.categories || []).map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${encodeURIComponent(cat.slug)}`}
                className="card home-categoryCard"
              >
                <div className="home-categoryCard__name">{cat.name}</div>
                <div className="home-categoryCard__meta muted">
                  {cat.children?.length ? `${cat.children.length} nhánh` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-page home-section home-section--bottom">
        <div className="home-section__head">
          <h2 className="home-section__title">Flash sale</h2>
          <Link to="/products" className="home-section__link">Xem thêm</Link>
        </div>

        {loading ? (
          <div className="home-grid home-grid--products">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card home-skeletonCard">
                <div className="skeleton home-skeletonCard__media" />
                <div className="skeleton home-skeletonCard__line" />
                <div className="skeleton home-skeletonCard__line home-skeletonCard__line--short" />
              </div>
            ))}
          </div>
        ) : (
          <div className="home-grid home-grid--products">
            {(data.flashSale || []).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="container-page home-section home-section--bottom">
        <div className="home-section__head">
          <h2 className="home-section__title">Shop uy tín</h2>
          <Link to="/products" className="home-section__link">Mua sắm ngay</Link>
        </div>

        {loading ? (
          <div className="home-grid home-grid--shops">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card home-skeletonCard">
                <div className="home-skeletonCard__shopHead">
                  <div className="skeleton home-skeletonCard__shopLogo" />
                  <div className="home-skeletonCard__shopMeta">
                    <div className="skeleton home-skeletonCard__shopLine" />
                    <div className="skeleton home-skeletonCard__shopLine home-skeletonCard__shopLine--short" />
                  </div>
                </div>
                <div className="skeleton home-skeletonCard__line" />
                <div className="skeleton home-skeletonCard__line home-skeletonCard__line--short" />
              </div>
            ))}
          </div>
        ) : (
          <div className="home-grid home-grid--shops">
            {(data.topShops || []).map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        )}
      </section>

      <section className="container-page home-section home-section--last">
        <div className="home-section__head">
          <h2 className="home-section__title">Gợi ý hôm nay</h2>
          <Link to="/products" className="home-section__link">Xem thêm</Link>
        </div>

        {loading ? (
          <div className="home-grid home-grid--products">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card home-skeletonCard">
                <div className="skeleton home-skeletonCard__media" />
                <div className="skeleton home-skeletonCard__line" />
                <div className="skeleton home-skeletonCard__line home-skeletonCard__line--short" />
              </div>
            ))}
          </div>
        ) : (
          <div className="home-grid home-grid--products">
            {(data.featured || []).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
