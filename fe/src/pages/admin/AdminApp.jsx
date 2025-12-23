import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AdminSellers from "./AdminSellers";
import AdminCategories from "./AdminCategories";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`
      }
    >
      {children}
    </NavLink>
  );
}

export default function AdminApp() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container-page flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold hover:underline">
              ← Về trang mua sắm
            </Link>
            <span className="text-sm text-slate-400">/</span>
            <span className="text-sm font-semibold">Admin Console</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">{user?.email}</div>
            <button className="btn btn-ghost" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      <div className="container-page py-6 grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quản trị</div>
          <div className="mt-3 space-y-1">
            <NavItem to="/admin/sellers">Duyệt Shop</NavItem>
            <NavItem to="/admin/categories">Danh mục</NavItem>
          </div>
        </aside>

        <main className="min-w-0">
          <Routes>
            <Route index element={<AdminSellers />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="*" element={<div className="card p-6">Không tìm thấy trang.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
