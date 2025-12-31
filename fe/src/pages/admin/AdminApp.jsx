import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AdminSellers from "./AdminSellers";
import AdminCategories from "./AdminCategories";
import AdminVouchers from "./AdminVouchers";
import AdminShopCenter from "./AdminShopCenter";
import AdminDisputes from "./AdminDisputes";

import "./AdminApp.css";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        "admin-nav__item" + (isActive ? " admin-nav__item--active" : "")
      }
    >
      {children}
    </NavLink>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <div className="admin-shell__topbar">
        <div className="container-page admin-shell__topbarInner">
          <div className="admin-shell__crumbs">
            <Link to="/" className="admin-shell__backLink">
              ← Về trang mua sắm
            </Link>
            <span className="admin-shell__crumbSep">/</span>
            <span className="admin-shell__crumbCurrent">Quản trị hệ thống</span>
          </div>
          <div className="admin-shell__user">
            <div className="admin-shell__userEmail">{user?.email}</div>
            <button className="btn-ghost" onClick={logout} type="button">
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="container-page admin-shell__content dashboard-layout">
        <aside className="card admin-shell__sidebar dashboard-sidebar">
          <div className="admin-nav__title">Quản trị</div>
          <nav className="admin-nav">
            <NavItem to="/admin/sellers">Duyệt Shop</NavItem>
            <NavItem to="/admin/shops">Shop & Báo cáo</NavItem>
            <NavItem to="/admin/disputes">Khiếu nại</NavItem>
            <NavItem to="/admin/categories">Danh mục</NavItem>
            <NavItem to="/admin/vouchers">Voucher sàn</NavItem>
          </nav>
        </aside>

        <main className="dashboard-main">
          <Routes>
            <Route index element={<AdminSellers />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="shops" element={<AdminShopCenter />} />
            <Route path="shop-reports" element={<Navigate to="/admin/shops?tab=reports" replace />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="vouchers" element={<AdminVouchers />} />
            <Route path="shop-vouchers" element={<Navigate to="/admin/vouchers" replace />} />
            <Route path="*" element={<div className="card admin-shell__notFound">Không tìm thấy trang.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
