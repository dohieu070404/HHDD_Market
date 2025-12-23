import { useEffect, useMemo, useState } from "react";
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
    <div className="space-y-1">
      {categories.map((c) => (
        <div key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.slug)}
            className={
              "w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 " +
              (selectedSlug === c.slug ? "bg-slate-100 font-semibold" : "")
            }
          >
            {c.name}
          </button>
          {c.children?.length ? (
            <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3">
              {c.children.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onSelect(ch.slug)}
                  className={
                    "w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 " +
                    (selectedSlug === ch.slug ? "bg-slate-100 font-semibold" : "")
                  }
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
        const res = await publicApi.listProducts({
          q,
          category,
          sort,
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
    <div className="container-page py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Sản phẩm</h1>
          <p className="muted text-sm">Tìm kiếm, lọc theo danh mục – sắp xếp theo giá / đánh giá / tên.</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Sắp xếp:</label>
          <select className="select w-56" value={sort} onChange={(e) => updateParam({ sort: e.target.value, page: 1 })}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="card p-4 h-fit">
          <div className="text-sm font-semibold">Bộ lọc</div>

          <div className="mt-4">
            <div className="label mb-2">Danh mục</div>
            <button
              type="button"
              className={
                "w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 " +
                (!category ? "bg-slate-100 font-semibold" : "")
              }
              onClick={() => updateParam({ category: "", page: 1 })}
            >
              Tất cả
            </button>
            <div className="mt-2">
              <CategoryTree categories={categories} selectedSlug={category} onSelect={(slug) => updateParam({ category: slug, page: 1 })} />
            </div>
          </div>

          <div className="mt-6">
            <div className="label mb-2">Khoảng giá</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Từ"
                value={minPrice}
                onChange={(e) => updateParam({ minPrice: e.target.value })}
              />
              <input
                className="input"
                placeholder="Đến"
                value={maxPrice}
                onChange={(e) => updateParam({ maxPrice: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="label mb-2">Đánh giá tối thiểu</div>
            <select
              className="select"
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

          <div className="mt-6 flex items-center justify-between">
            <Link
              to={`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Xóa lọc
            </Link>
            <div className="text-xs muted">Tổng: {pagination.total || 0}</div>
          </div>
        </aside>

        <section>
          {loading ? (
            <div className="card p-6">Đang tải...</div>
          ) : error ? (
            <div className="card p-6 text-red-600">{error}</div>
          ) : list.items?.length ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {list.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  className="btn-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => updateParam({ page: pagination.page - 1 })}
                >
                  Trang trước
                </button>
                <div className="text-sm text-slate-600">
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
            <div className="card p-6">Không có sản phẩm phù hợp.</div>
          )}
        </section>
      </div>
    </div>
  );
}
