import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import SellerOverview from "./SellerOverview";
import SellerProducts from "./SellerProducts";
import SellerOrders from "./SellerOrders";
import SellerOrderDetail from "./SellerOrderDetail";
import SellerSettings from "./SellerSettings";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        "block rounded-lg px-3 py-2 text-sm " + (isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100")
      }
    >
      {children}
    </NavLink>
  );
}

export default function SellerApp() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container-page py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-slate-600">Seller Center</div>
            <div className="font-semibold">{user?.shop?.name || "Shop"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="btn">Về trang mua hàng</Link>
            <button className="btn" onClick={logout}>Đăng xuất</button>
          </div>
        </div>
      </div>

      <div className="container-page py-6 grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="card p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Menu</div>
          <div className="mt-3 grid gap-1">
            <NavItem to="/seller">Tổng quan</NavItem>
            <NavItem to="/seller/products">Sản phẩm</NavItem>
            <NavItem to="/seller/orders">Đơn hàng</NavItem>
            <NavItem to="/seller/settings">Thiết lập shop</NavItem>
          </div>
        </aside>

        <main className="min-w-0">
          <Routes>
            <Route index element={<SellerOverview />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:code" element={<SellerOrderDetail />} />
            <Route path="settings" element={<SellerSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
