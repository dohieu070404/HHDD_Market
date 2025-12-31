import React, { useMemo, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import UserMenu from "./UserMenu.jsx";
import "./Header.css";

function Icon({ children }) {
  return (
    <span className="navIcon" aria-hidden>
      {children}
    </span>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const { count } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");

  const cartBadge = useMemo(() => (count > 99 ? "99+" : String(count)), [count]);

  function submitSearch(e) {
    e.preventDefault();
    const query = (q || "").trim();
    if (!query) {
      navigate("/products");
      setMobileOpen(false);
      return;
    }
    navigate(`/products?q=${encodeURIComponent(query)}`);
    setMobileOpen(false);
  }

  return (
    <header className="header">
      <div className="container headerInner">
        <div className="headerLeft">
          <button
            className="burger"
            type="button"
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰
          </button>

          <Link className="brand" to="/">
            <span className="brandMark">◼</span>
            <span className="brandText">Shop Dark</span>
          </Link>

          <form className="headerSearch" onSubmit={submitSearch} role="search">
            <input
              className="headerSearchInput"
              placeholder="Tìm kiếm sản phẩm..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="headerSearchBtn" type="submit" aria-label="Tìm kiếm">
              🔎
            </button>
          </form>

          <nav className={mobileOpen ? "nav navOpen" : "nav"}>
            <NavLink to="/" className={({ isActive }) => (isActive ? "navLink active" : "navLink")} end>
              <Icon>🏠</Icon> Home
            </NavLink>

            <NavLink
              to="/products"
              className={({ isActive }) => (isActive ? "navLink active" : "navLink")}
            >
              <Icon>🛍</Icon> Sản phẩm
            </NavLink>

            <NavLink
              to="/guide"
              className={({ isActive }) => (isActive ? "navLink active" : "navLink")}
            >
              <Icon>📘</Icon> Hướng dẫn
            </NavLink>

            <NavLink to="/cart" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
              <Icon>🛒</Icon> Giỏ hàng
              {count > 0 ? <span className="badge">{cartBadge}</span> : null}
            </NavLink>

            {isAuthenticated ? (
              <NavLink
                to="/orders"
                className={({ isActive }) => (isActive ? "navLink active" : "navLink")}
              >
                <Icon>🧾</Icon> Đơn hàng
              </NavLink>
            ) : null}

            {isAuthenticated && ["SELLER", "ADMIN"].includes(user?.role) ? (
              <NavLink
                to="/seller"
                className={({ isActive }) => (isActive ? "navLink active" : "navLink")}
              >
                <Icon>🏬</Icon> Trung tâm bán hàng
              </NavLink>
            ) : null}

            {isAuthenticated && ["ADMIN", "CS"].includes(user?.role) ? (
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? "navLink active" : "navLink")}
              >
                <Icon>🛠️</Icon> Admin
              </NavLink>
            ) : null}
          </nav>
        </div>

        <div className="headerRight">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
