import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function ProtectedRoute({ children, roles }) {
  const { booting, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="center-screen">
        <div className="spinner" />
        <div className="muted" style={{ marginTop: 12 }}>
          Đang tải…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && Array.isArray(roles) && roles.length > 0) {
    const ok = roles.includes(user?.role);
    if (!ok) {
      return (
        <div className="center-screen">
          <div className="muted">Bạn không có quyền truy cập trang này.</div>
        </div>
      );
    }
  }

  return children;
}
