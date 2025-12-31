import { Link, NavLink, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart, Store, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import "./SiteLayout.css";

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
    if (role === "SELLER") return { to: "/seller", label: "Trung tâm bán hàng", icon: Store };
    if (role === "ADMIN" || role === "CS") return { to: "/admin", label: "Quản trị", icon: Shield };
    return { to: "/open-shop", label: "Mở shop", icon: Store };
  }, [token, role]);

  function onSearchSubmit(e) {
    e.preventDefault();
    navigate(`/products?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="site-layout">
      <header className="site-header" role="banner">
        <div className="site-header__top">
          <div className="container-page site-header__topInner">
            <Link to="/" className="site-brand">
              <span className="site-brand__mark" aria-hidden>
                S
              </span>
              <span className="site-brand__name">ShopEZ</span>
            </Link>

            <form onSubmit={onSearchSubmit} className="site-search" role="search">
              <Search className="site-search__icon" aria-hidden />
              <input
                className="input site-search__input"
                placeholder="Tìm sản phẩm, shop..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </form>

            <div className="site-header__actions">
              {primaryLink ? (
                <Link to={primaryLink.to} className="btn-secondary site-header__primaryLink">
                  <primaryLink.icon className="site-header__primaryIcon" aria-hidden />
                  {primaryLink.label}
                </Link>
              ) : null}

              <Link to="/cart" className="btn-ghost site-cart" aria-label="Giỏ hàng">
                <ShoppingCart className="site-cart__icon" aria-hidden />
                {itemCount > 0 ? <span className="site-cart__badge">{itemCount}</span> : null}
              </Link>

              {!token ? (
                <div className="site-auth">
                  <Link to="/login" className="btn-secondary">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="btn-primary site-auth__register">
                    Đăng ký
                  </Link>
                </div>
              ) : (
                <div className="site-user">
                  <Link to="/profile" className="btn-ghost site-user__profile">
                    <span className="site-user__avatar" title={user?.username || user?.email || ""}>
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="avatar" className="site-user__avatarImg" />
                      ) : (
                        <span className="site-user__avatarFallback">
                          {(user?.username || user?.email || "U").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="site-user__name">{user?.username || user?.email}</span>
                  </Link>
                  <button className="btn-secondary" type="button" onClick={logout}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="site-nav">
          <div className="container-page site-nav__inner">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "site-nav__item site-nav__item--active" : "site-nav__item")}
            >
              Trang chủ
            </NavLink>
            <NavLink
              to="/products"
              className={({ isActive }) => (isActive ? "site-nav__item site-nav__item--active" : "site-nav__item")}
            >
              Sản phẩm
            </NavLink>
            {token ? (
              <>
                <NavLink
                  to="/orders"
                  className={({ isActive }) =>
                    isActive ? "site-nav__item site-nav__item--active" : "site-nav__item"
                  }
                >
                  Đơn hàng
                </NavLink>
                <NavLink
                  to="/complaints"
                  className={({ isActive }) =>
                    isActive ? "site-nav__item site-nav__item--active" : "site-nav__item"
                  }
                >
                  Khiếu nại
                </NavLink>
                <NavLink
                  to="/reviews"
                  className={({ isActive }) =>
                    isActive ? "site-nav__item site-nav__item--active" : "site-nav__item"
                  }
                >
                  Đánh giá
                </NavLink>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="site-main" role="main">
        <Outlet />
      </main>

      <footer className="site-footer" role="contentinfo">
        <div className="container-page site-footer__inner">
          <div className="site-footer__row">
            <div>© {new Date().getFullYear()} ShopEZ</div>
            <div className="site-footer__links">
              <Link to="/guide" className="site-footer__link">
                Hướng dẫn sử dụng
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
