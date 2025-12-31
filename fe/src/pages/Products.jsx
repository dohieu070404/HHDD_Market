import { useEffect, useMemo, useState } from "react";
import "./Products.css";
import { Link, useSearchParams } from "react-router-dom";
import { publicApi } from "../api/public";
import ProductCard from "../components/product/ProductCard";

function toNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function CategoryTree({ categories, selectedSlug, onSelect }) {
  return (
    <div className="products-filter__tree">
      {categories.map((c) => (
        <div key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.slug)}
            className={selectedSlug === c.slug ? "products-filter__item products-filter__item--active" : "products-filter__item"}
          >
            {c.name}
          </button>
          {c.children?.length ? (
            <div className="products-filter__children">
              {c.children.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelect(ch.slug)}
                  className={selectedSlug === ch.slug ? "products-filter__item products-filter__item--active" : "products-filter__item"}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const shop = searchParams.get("shop") || "";
  const sort = searchParams.get("sort") || "new";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const minRating = searchParams.get("minRating") || "";

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState({ items: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 1 } });
  const [error, setError] = useState(null);

  const sortOptions = useMemo(
    () => [
      { value: "new", label: "Mới nhất" },
      { value: "rating_desc", label: "Đánh giá cao" },
      { value: "sold_desc", label: "Bán chạy" },
      { value: "price_asc", label: "Giá tăng dần" },
      { value: "price_desc", label: "Giá giảm dần" },
      { value: "name_asc", label: "Tên A-Z" },
      { value: "name_desc", label: "Tên Z-A" },
    ],
    []
  );

  useEffect(() => {
    (async () => {
      const res = await publicApi.listCategories();
      if (res?.success) setCategories(res.data || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await publicApi.listProducts({ q, category, shop, sort,
          minPrice: toNumOrNull(minPrice),
          maxPrice: toNumOrNull(maxPrice),
          minRating: toNumOrNull(minRating),
          page,
          limit: 12,
        });
        if (res?.success) {
          setList(res.data);
          setError(null);
        } else {
          setError(res?.message || "Không tải được danh sách sản phẩm");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [q, category, sort, page, minPrice, maxPrice, minRating]);

  function updateParam(next) {
    const sp = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") sp.delete(k);
      else sp.set(k, String(v));
    });
    // Reset page on filter changes
    if (Object.keys(next).some((k) => k !== "page")) {
      if (next.page === undefined) sp.set("page", "1");
    }
    setSearchParams(sp);
  }

  const pagination = list.pagination || { page: 1, totalPages: 1 };

  return (
    <div className="products-page">
      <div className="container-page products-page__container">
        <div className="products-page__header">
          <div className="products-page__heading">
            <h1 className="products-page__title">Sản phẩm</h1>
            <p className="products-page__subtitle muted">Tìm kiếm, lọc theo danh mục – sắp xếp theo giá / đánh giá / tên.</p>
          </div>

          <div className="products-page__sort">
            <label className="products-page__sortLabel">Sắp xếp:</label>
            <select
              className="select products-page__sortSelect"
              value={sort}
              onChange={(e) => updateParam({ sort: e.target.value, page: 1 })}
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="layout-sidebar-280 products-page__grid">
          <aside className="card products-filter">
            <div className="products-filter__title">Bộ lọc</div>

          <div className="products-filter__section">
            <div className="label products-filter__sectionLabel">Danh mục</div>
            <button
              type="button"
              className={!category ? "products-filter__item products-filter__item--active" : "products-filter__item"}
              onClick={() => updateParam({ category: "", page: 1 })}
            >
              Tất cả
            </button>
            <div className="products-filter__treeWrap">
              <CategoryTree categories={categories} selectedSlug={category} onSelect={(slug) => updateParam({ category: slug, page: 1 })} />
            </div>
          </div>

          <div className="products-filter__section">
            <div className="label products-filter__sectionLabel">Khoảng giá</div>
            <div className="products-filter__priceRow">
              <input
                className="input products-filter__priceInput"
                placeholder="Từ"
                value={minPrice}
                onChange={(e) => updateParam({ minPrice: e.target.value })}
              />
              <input
                className="input products-filter__priceInput"
                placeholder="Đến"
                value={maxPrice}
                onChange={(e) => updateParam({ maxPrice: e.target.value })}
              />
            </div>
          </div>

          <div className="products-filter__section">
            <div className="label products-filter__sectionLabel">Đánh giá tối thiểu</div>
            <select
              className="select products-filter__ratingSelect"
              value={minRating}
              onChange={(e) => updateParam({ minRating: e.target.value, page: 1 })}
            >
              <option value="">Tất cả</option>
              <option value="4">Từ 4⭐</option>
              <option value="3">Từ 3⭐</option>
              <option value="2">Từ 2⭐</option>
              <option value="1">Từ 1⭐</option>
            </select>
          </div>

          <div className="products-filter__footer">
            <Link
              to={`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="products-filter__clear"
            >
              Xóa lọc
            </Link>
            <div className="products-filter__total muted">Tổng: {pagination.total || 0}</div>
          </div>
        </aside>

        <section className="products-results">
          {loading ? (
            <div className="card products-results__message">Đang tải...</div>
          ) : error ? (
            <div className="card products-results__message products-results__message--error">{error}</div>
          ) : list.items?.length ? (
            <>
              <div className="products-results__grid">
                {list.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              <div className="products-results__pagination">
                <button
                  className="btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => updateParam({ page: pagination.page - 1 })}
                >
                  Trang trước
                </button>
                <div className="products-results__pageInfo">
                  Trang {pagination.page} / {pagination.totalPages}
                </div>
                <button
                  className="btn-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => updateParam({ page: pagination.page + 1 })}
                >
                  Trang sau
                </button>
              </div>
            </>
          ) : (
            <div className="card products-results__message">Không có sản phẩm phù hợp.</div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
