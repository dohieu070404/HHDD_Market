import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicApi } from "../api/public";
import ProductCard from "../components/product/ProductCard";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ categories: [], featured: [] });
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
    <div>
      <section className="bg-white border-b border-slate-200">
        <div className="container-page py-10">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Marketplace SuperFake cua shopee
              </h1>
              <p className="mt-3 text-slate-600 leading-relaxed">
                Mua một tặng 2 tính tiền 3 miễn phí vận chuyển toàn cầu. Mở shop ngay hôm nay để bán hàng và kiếm tiền online dễ dàng hơn bao giờ hết!
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link to="/products" className="btn-primary">Khám phá sản phẩm</Link>
                <Link to="/open-shop" className="btn-secondary">Mở shop</Link>
              </div>

            </div>

            {/* <div className="card p-6">
              <div className="text-sm font-medium">Demo accounts</div>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-700">Customer</span>
                  <span className="font-mono">customer@shop.local / Customer@123</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-700">Seller</span>
                  <span className="font-mono">seller@shop.local / Seller@123</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-slate-700">Admin</span>
                  <span className="font-mono">admin@shop.local / Admin@123</span>
                </div>
              </div>
              <p className="muted mt-3 text-xs">
                *Nếu bạn đã seed DB: các tài khoản trên có sẵn.
              </p>
            </div> */}
          </div>
        </div>
      </section>

      <section className="container-page py-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Danh mục nổi bật</h2>
          <Link to="/products" className="text-sm text-slate-600 hover:text-slate-900">Xem tất cả</Link>
        </div>

        {loading ? (
          <div className="mt-4 card p-6">Đang tải...</div>
        ) : error ? (
          <div className="mt-4 card p-6 text-red-600">{error}</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {(data.categories || []).map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${encodeURIComponent(cat.slug)}`}
                className="card p-4 hover:border-slate-300"
              >
                <div className="font-medium">{cat.name}</div>
                <div className="muted mt-1 text-xs">
                  {cat.children?.length ? `${cat.children.length} nhánh` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-page pb-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gợi ý hôm nay</h2>
          <Link to="/products" className="text-sm text-slate-600 hover:text-slate-900">Xem thêm</Link>
        </div>

        {loading ? (
          <div className="mt-4 card p-6">Đang tải...</div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(data.featured || []).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
