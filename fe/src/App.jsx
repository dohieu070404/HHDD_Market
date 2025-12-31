import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";

import SiteLayout from "./components/layout/SiteLayout";
import RequireAuth from "./components/auth/RequireAuth";
import RequireRole from "./components/auth/RequireRole";

import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import ShopDetail from "./pages/ShopDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderGroupDetail from "./pages/OrderGroupDetail";
import OrderDetail from "./pages/OrderDetail";
import Profile from "./pages/Profile";
import OpenShop from "./pages/OpenShop";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Guide from "./pages/Guide";
import Complaints from "./pages/Complaints";
import Reviews from "./pages/Reviews";
import NotFound from "./pages/NotFound";

import SellerApp from "./pages/seller/SellerApp";
import AdminApp from "./pages/admin/AdminApp";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<Products />} />
              <Route path="p/:slug" element={<ProductDetail />} />
              <Route path="shop/:slug" element={<ShopDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route
                path="checkout"
                element={
                  <RequireAuth>
                    <Checkout />
                  </RequireAuth>
                }
              />
              <Route
                path="orders"
                element={
                  <RequireAuth>
                    <Orders />
                  </RequireAuth>
                }
              />
              <Route
                path="complaints"
                element={
                  <RequireAuth>
                    <Complaints />
                  </RequireAuth>
                }
              />
              <Route
                path="reviews"
                element={
                  <RequireAuth>
                    <Reviews />
                  </RequireAuth>
                }
              />
              <Route
                path="orders/o/:code"
                element={
                  <RequireAuth>
                    <OrderDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="orders/:code"
                element={
                  <RequireAuth>
                    <OrderGroupDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="profile"
                element={
                  <RequireAuth>
                    <Profile />
                  </RequireAuth>
                }
              />
              <Route
                path="open-shop"
                element={
                  <RequireAuth>
                    <OpenShop />
                  </RequireAuth>
                }
              />

              <Route path="guide" element={<Guide />} />

              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>

            <Route
              path="seller/*"
              element={
                <RequireRole roles={["SELLER"]}>
                  <SellerApp />
                </RequireRole>
              }
            />

            <Route
              path="admin/*"
              element={
                <RequireRole roles={["ADMIN", "CS"]}>
                  <AdminApp />
                </RequireRole>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
