import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import SellerOverview from "./SellerOverview";
import SellerWarehouse from "./SellerWarehouse";
import SellerOrders from "./SellerOrders";
import SellerOrderDetail from "./SellerOrderDetail";
import SellerSettings from "./SellerSettings";
import SellerReviews from "./SellerReviews";
import SellerInventory from "./SellerInventory";
import SellerVouchers from "./SellerVouchers";
import SellerReturns from "./SellerReturns";
import SellerShipping from "./SellerShipping";
import SellerNotifications from "./SellerNotifications";
import SellerDisputes from "./SellerDisputes";

import "./SellerApp.css";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => (isActive ? "seller-nav__item seller-nav__item--active" : "seller-nav__item")}
    >
      {children}
    </NavLink>
  );
}

export default function SellerApp() {
  const { user, logout } = useAuth();

  return (
    <div className="seller-shell">
      <header className="seller-shell__topbar">
        <div className="container-page seller-shell__topbarInner">
          <div className="seller-shell__meta">
            <div className="seller-shell__kicker">Trung tâm bán hàng</div>
            <div className="seller-shell__shopName">{user?.shop?.name || "Shop"}</div>
          </div>
          <div className="seller-shell__actions">
            <Link to="/" className="btn-secondary">Về trang mua hàng</Link>
            <button className="btn-secondary" onClick={logout}>Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className="container-page seller-shell__content dashboard-layout">
        <aside className="card seller-shell__sidebar dashboard-sidebar">
          <div className="seller-nav__title">Danh mục</div>
          <nav className="seller-nav" aria-label="Seller navigation">
            <NavItem to="/seller">Tổng quan</NavItem>
            <NavItem to="/seller/warehouse">Kho hàng</NavItem>
            <NavItem to="/seller/orders">Đơn hàng</NavItem>
            <NavItem to="/seller/returns">Trả hàng/Hoàn tiền</NavItem>
            <NavItem to="/seller/reviews">Đánh giá</NavItem>
            {/* Tồn kho đã gộp vào Kho hàng */}
            <NavItem to="/seller/shipping">Vận chuyển</NavItem>
            <NavItem to="/seller/vouchers">Voucher</NavItem>
            <NavItem to="/seller/disputes">Khiếu nại</NavItem>
            <NavItem to="/seller/notifications">Cảnh báo</NavItem>
            <NavItem to="/seller/settings">Thiết lập shop</NavItem>
          </nav>
        </aside>

        <main className="dashboard-main">
          <Routes>
            <Route index element={<SellerOverview />} />
            <Route path="warehouse" element={<SellerWarehouse />} />
            <Route path="products" element={<SellerWarehouse />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:code" element={<SellerOrderDetail />} />
            {/* route cũ giữ lại để không gãy link, nhưng sidebar đã ẩn */}
            <Route path="inventory" element={<SellerInventory />} />
            <Route path="shipping" element={<SellerShipping />} />
            <Route path="vouchers" element={<SellerVouchers />} />
            <Route path="returns" element={<SellerReturns />} />
            <Route path="reviews" element={<SellerReviews />} />
            <Route path="disputes" element={<SellerDisputes />} />
            <Route path="notifications" element={<SellerNotifications />} />
            <Route path="settings" element={<SellerSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
