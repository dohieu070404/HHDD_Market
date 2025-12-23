import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart, Store, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";

function classNames(...c) {
  return c.filter(Boolean).join(" ");
}

export default function SiteLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const { user, token, logout } = useAuth();
  const { itemCount } = useCart();

  const role = user?.role;

  const primaryLink = useMemo(() => {
    if (!token) return null;
    if (role === "SELLER") return { to: "/seller", label: "Seller Center", icon: Store };
    if (role === "ADMIN" || role === "CS") return { to: "/admin", label: "Admin Console", icon: Shield };
    return { to: "/open-shop", label: "Mở Shop", icon: Store };
  }, [token, role]);

  function onSearchSubmit(e) {
    e.preventDefault();
    navigate(`/products?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container-page py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">S</span>
            <span className="hidden sm:inline">ShopEZ</span>
          </Link>

          <form onSubmit={onSearchSubmit} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Tìm sản phẩm, shop..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            {primaryLink && (
              <Link
                to={primaryLink.to}
                className="btn-secondary hidden md:inline-flex"
              >
                <primaryLink.icon className="h-4 w-4" />
                {primaryLink.label}
              </Link>
            )}

            <Link to="/cart" className="btn-ghost relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1 text-xs text-white">
                  {itemCount}
                </span>
              )}
            </Link>

            {!token ? (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-secondary">Đăng nhập</Link>
                <Link to="/register" className="btn-primary hidden sm:inline-flex">Đăng ký</Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/profile"
                  className="btn-ghost hidden sm:inline-flex"
                >
                  <span className={classNames("h-8 w-8 rounded-full bg-slate-200 overflow-hidden", user?.avatarUrl ? "" : "flex items-center justify-center")}
                    title={user?.username}
                  >
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-700">{(user?.username || user?.email || "U").slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="text-sm font-medium">{user?.username || user?.email}</span>
                </Link>
                <button className="btn-secondary" onClick={logout}>Đăng xuất</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="container-page py-8 text-sm text-slate-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} ShopEZ – Demo Marketplace</div>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-slate-700">Trang chủ</Link>
              <Link to="/products" className="hover:text-slate-700">Sản phẩm</Link>
              {token && <Link to="/orders" className="hover:text-slate-700">Đơn hàng</Link>}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
