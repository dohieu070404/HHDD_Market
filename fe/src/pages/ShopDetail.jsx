import { useEffect, useMemo, useState } from "react";
import "./ShopDetail.css";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { publicApi } from "../api/public";
import { customerApi } from "../api/customer";
import ProductCard from "../components/product/ProductCard";
import Skeleton from "../components/ui/Skeleton";
import { useAuth } from "../contexts/AuthContext";

function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function TabButton({ active, children, onClick }) {
  return (
    <button type="button" className={"shop-tab " + (active ? "shop-tab--active" : "")} onClick={onClick}>
      {children}
    </button>
  );
}

function VoucherCard({ v }) {
  const isPercent = v.type === "PERCENT";
  const value = isPercent ? `${v.value}%` : `${v.value.toLocaleString("vi-VN")} ₫`;
  const sub = v.minSubtotal ? `ĐH tối thiểu ${v.minSubtotal.toLocaleString("vi-VN")} ₫` : "Không giới hạn";

  return (
    <div className="voucher-card">
      <div className="voucher-value">{value}</div>
      <div className="voucher-code">{v.code}</div>
      <div className="voucher-sub">{sub}</div>
      {v.maxDiscount ? <div className="voucher-sub">Giảm tối đa {v.maxDiscount.toLocaleString("vi-VN")} ₫</div> : null}
    </div>
  );
}

export default function ShopDetail() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const tab = searchParams.get("tab") || "products"; // products | vouchers | about

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "new";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const minRating = searchParams.get("minRating") || "";

  const [shop, setShop] = useState(null);
  const [stats, setStats] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loadingShop, setLoadingShop] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [err, setErr] = useState(null);

  const filters = useMemo(
    () => ({
      q,
      category,
      shop: slug,
      sort,
      page,
      limit: 12,
      minPrice: toNumOrNull(minPrice),
      maxPrice: toNumOrNull(maxPrice),
      minRating: toNumOrNull(minRating),
    }),
    [q, category, slug, sort, page, minPrice, maxPrice, minRating]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingShop(true);
        setErr(null);
        const res = await publicApi.getShop(slug);
        if (!alive) return;
        if (res?.success) {
          setShop(res.data.shop);
          setStats(res.data.stats || null);
          setVouchers(res.data.vouchers || []);
          setCategories(res.data.categories || []);
        } else {
          setErr(res?.message || "Không tải được shop");
        }
      } catch (e) {
        setErr(e?.message || "Không tải được shop");
      } finally {
        if (alive) setLoadingShop(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  useEffect(() => {
    if (tab !== "products") return;

    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const res = await publicApi.listProducts(filters);
        if (!alive) return;
        if (res?.success) {
          setProducts(res.data.items || []);
          setPagination(res.data.pagination || null);
        } else {
          setProducts([]);
          setPagination(null);
        }
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filters, tab]);

  function updateParam(next, { keepPage } = {}) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined) sp.delete(k);
      else sp.set(k, String(v));
    });
    if (!keepPage && !("page" in next)) sp.set("page", "1");
    setSearchParams(sp);
  }

  async function onReportShop() {
    if (!user) {
      alert("Vui lòng đăng nhập để báo cáo shop");
      return;
    }
    if (shop?.ownerId && user?.id === shop.ownerId) {
      alert("Bạn không thể báo cáo shop của chính mình");
      return;
    }

    const reason = window.prompt("Lý do báo cáo shop (ví dụ: hàng giả, spam, lừa đảo...)");
    if (!reason || !reason.trim()) return;
    const description = window.prompt("Mô tả chi tiết (tuỳ chọn)") || "";

    const res = await customerApi.reportShop(slug, { reason: reason.trim(), description: description.trim() || undefined });
    if (res?.success) alert("Đã gửi báo cáo. Cảm ơn bạn!");
    else alert(res?.message || "Không gửi được báo cáo");
  }

  return (
    <div className="container-page page-shop-tiki">
      <div className="breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span> / </span>
        <span>Shop</span>
        {shop?.name ? (
          <>
            <span> / </span>
            <span>{shop.name}</span>
          </>
        ) : null}
      </div>

      {loadingShop ? (
        <div className="card shop-loadingCard">
          <div className="shop-loadingCard__row">
            <Skeleton className="shop-loadingCard__avatar" />
            <div className="shop-loadingCard__meta">
              <Skeleton className="shop-loadingCard__line shop-loadingCard__line--lg" />
              <Skeleton className="shop-loadingCard__line shop-loadingCard__line--md" />
            </div>
            <Skeleton className="shop-loadingCard__cta" />
          </div>
        </div>
      ) : err ? (
        <div className="alert alert--error">{err}</div>
      ) : (
        <>
          {/* HERO */}
          <div className="shop-hero-tiki">
            <div className="shop-hero-tiki__banner" />

            <div className="shop-hero-tiki__content">
              <div className="shop-hero-tiki__identity">
                <div className="shop-hero-tiki__avatar">
                  {shop?.logoUrl ? <img src={shop.logoUrl} alt={shop?.name || "shop"} /> : <span>{(shop?.name || "S").slice(0, 1).toUpperCase()}</span>}
                </div>

                <div className="shop-hero-tiki__info">
                  <div className="shop-hero-tiki__name" title={shop?.name || ""}>{shop?.name}</div>
                  <div className="shop-hero-tiki__meta">
                    <span className="shop-hero-tiki__ratingValue">{stats?.ratingAvg || shop?.ratingAvg || 0}</span>
                    <span className="muted">/5</span>
                    <span className="dot">•</span>
                    <span className="muted">{(stats?.ratingCount || shop?.ratingCount || 0).toLocaleString("vi-VN")} đánh giá</span>
                    <span className="dot">•</span>
                    <span className="muted">{(shop?._count?.products || 0).toLocaleString("vi-VN")} sản phẩm</span>
                  </div>

                  {shop?.shopAddresses?.[0] ? (
                    <div className="shop-hero-tiki__addr muted">
                      {shop.shopAddresses[0].district}, {shop.shopAddresses[0].city}
                    </div>
                  ) : shop?.description ? (
                    <div className="shop-hero-tiki__addr shop-hero-tiki__desc muted">{shop.description}</div>
                  ) : null}
                </div>
              </div>

              <div className="shop-hero-tiki__actions">
                <button className="btn btn-outline" type="button" onClick={() => alert("Tính năng theo dõi sẽ được bổ sung sau")}>Theo dõi</button>
                <button className="btn btn-primary" type="button" onClick={() => alert("Chat shop sẽ được bổ sung sau")}>Chat</button>
                <button className="btn btn-danger" type="button" onClick={onReportShop}>Báo cáo</button>
              </div>
            </div>

            {/* TABS */}
            <div className="shop-tabs-tiki">
              <TabButton active={tab === "products"} onClick={() => updateParam({ tab: "products" }, { keepPage: true })}>Sản phẩm</TabButton>
              <TabButton active={tab === "vouchers"} onClick={() => updateParam({ tab: "vouchers" }, { keepPage: true })}>Voucher</TabButton>
              <TabButton active={tab === "about"} onClick={() => updateParam({ tab: "about" }, { keepPage: true })}>Giới thiệu</TabButton>
            </div>
          </div>

          {/* BODY */}
          {tab === "vouchers" ? (
            <div className="card shop-section shop-section--vouchers">
              <div className="section-title">Voucher của shop</div>
              {vouchers?.length ? (
                <>
                  <div className="voucher-row shop-section__spaced">
                    {vouchers.map((v) => (
                      <VoucherCard key={v.id} v={v} />
                    ))}
                  </div>
                  <div className="muted shop-section__note">Voucher sẽ tự xuất hiện trong Checkout nếu đủ điều kiện.</div>
                </>
              ) : (
                <div className="empty shop-section__note">Shop chưa có voucher khả dụng.</div>
              )}
            </div>
          ) : tab === "about" ? (
            <div className="shop-aboutLayout">
              <div className="card shop-section shop-aboutMain">
                <div className="section-title">Giới thiệu shop</div>
                <div className="shop-aboutMain__desc">
                  {shop?.description ? shop.description : <span className="muted">Shop chưa cập nhật mô tả.</span>}
                </div>

                <div className="divider shop-aboutMain__divider" />

                <div className="section-title">Thông tin liên hệ</div>
                {shop?.shopAddresses?.length ? (
                  <div className="shop-aboutMain__addresses">
                    {shop.shopAddresses.map((a) => (
                      <div key={a.id} className="shop-aboutMain__address muted">
                        {a.addressLine}, {a.ward}, {a.district}, {a.city}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted shop-section__note">Chưa có địa chỉ hiển thị.</div>
                )}
              </div>

              <div className="card shop-section">
                <div className="section-title">Điểm nổi bật</div>
                <div className="shop-metrics">
                  <div className="shop-metric">
                    <span className="muted">Đánh giá</span>
                    <span className="shop-metric__value">{stats?.ratingAvg || shop?.ratingAvg || 0}/5</span>
                  </div>
                  <div className="shop-metric">
                    <span className="muted">Số đánh giá</span>
                    <span className="shop-metric__value">{(stats?.ratingCount || shop?.ratingCount || 0).toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="shop-metric">
                    <span className="muted">Sản phẩm</span>
                    <span className="shop-metric__value">{(shop?._count?.products || 0).toLocaleString("vi-VN")}</span>
                  </div>
                  <div className="shop-metric">
                    <span className="muted">Đơn hàng</span>
                    <span className="shop-metric__value">{(shop?._count?.orders || 0).toLocaleString("vi-VN")}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="shop-products-layout shop-products-layout--spaced">
              {/* Sidebar */}
              <aside className="shop-sidebar">
                <div className="card shop-sidebarCard">
                  <div className="section-title">Danh mục</div>
                  <div className="shop-cat-list" role="list">
                    <button
                      type="button"
                      className={"shop-cat-item " + (!category ? "shop-cat-item--active" : "")}
                      onClick={() => updateParam({ category: "" })}
                    >
                      <span>Tất cả</span>
                      <span className="shop-cat-count">{(shop?._count?.products || 0).toLocaleString("vi-VN")}</span>
                    </button>

                    {(categories || []).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={"shop-cat-item " + (category === c.slug ? "shop-cat-item--active" : "")}
                        onClick={() => updateParam({ category: c.slug })}
                        title={c.name}
                      >
                        <span className="shop-cat-name" title={c.name}>{c.name}</span>
                        <span className="shop-cat-count">{c.productCount || 0}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card shop-sidebarCard shop-sidebarCard--spaced">
                  <div className="section-title">Bộ lọc</div>

                  <div className="field">
                    <label>Tìm trong shop</label>
                    <input className="input" value={q} placeholder="Tên sản phẩm, từ khoá..." onChange={(e) => updateParam({ q: e.target.value })} />
                  </div>

                  <div className="field">
                    <label>Sắp xếp</label>
                    <select className="select" value={sort} onChange={(e) => updateParam({ sort: e.target.value })}>
                      <option value="new">Mới nhất</option>
                      <option value="sold_desc">Bán chạy</option>
                      <option value="price_asc">Giá thấp → cao</option>
                      <option value="price_desc">Giá cao → thấp</option>
                      <option value="rating_desc">Đánh giá cao</option>
                      <option value="name_asc">Tên A→Z</option>
                    </select>
                  </div>

                  <div className="shop-filterGrid">
                    <div className="field">
                      <label>Giá từ</label>
                      <input className="input" value={minPrice} onChange={(e) => updateParam({ minPrice: e.target.value })} placeholder="0" />
                    </div>
                    <div className="field">
                      <label>Đến</label>
                      <input className="input" value={maxPrice} onChange={(e) => updateParam({ maxPrice: e.target.value })} placeholder="999999" />
                    </div>
                  </div>

                  <div className="field">
                    <label>Rating ≥</label>
                    <select className="select" value={minRating} onChange={(e) => updateParam({ minRating: e.target.value })}>
                      <option value="">Tất cả</option>
                      <option value="4">4★+</option>
                      <option value="3">3★+</option>
                      <option value="2">2★+</option>
                    </select>
                  </div>
                </div>
              </aside>

              {/* Products */}
              <section className="shop-products">
                <div className="card shop-productsCard">
                  <div className="shop-productsHeader">
                    <div className="section-title">Sản phẩm trong shop</div>
                    <div className="muted shop-productsHeader__count">{pagination ? `${pagination.total.toLocaleString("vi-VN")} sản phẩm` : ""}</div>
                  </div>

                  {loadingProducts ? (
                    <div className="shop-productsGrid">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div className="card shop-productSkeleton" key={i}>
                          <Skeleton className="shop-productSkeleton__img" />
                          <Skeleton className="shop-productSkeleton__line shop-productSkeleton__line--lg" />
                          <Skeleton className="shop-productSkeleton__line shop-productSkeleton__line--md" />
                        </div>
                      ))}
                    </div>
                  ) : products?.length ? (
                    <>
                      <div className="shop-productsGrid">
                        {products.map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                      </div>

                      {pagination ? (
                        <div className="pagination">
                          <button className="btn btn-outline" disabled={pagination.page <= 1} onClick={() => updateParam({ page: pagination.page - 1 }, { keepPage: true })}>
                            Trước
                          </button>
                          <div className="muted pageInfo">
                            Trang {pagination.page} / {pagination.totalPages}
                          </div>
                          <button className="btn btn-outline" disabled={pagination.page >= pagination.totalPages} onClick={() => updateParam({ page: pagination.page + 1 }, { keepPage: true })}>
                            Sau
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="empty shop-productsCard__empty">Shop chưa có sản phẩm phù hợp.</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
