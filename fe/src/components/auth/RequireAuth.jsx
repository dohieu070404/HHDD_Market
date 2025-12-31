import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "./authGuard.css";

export default function RequireAuth({ children }) {
  const { token, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="auth-guard">
        <div className="container-page auth-guard__container">
          <div className="card auth-guard__card">Đang tải...</div>
        </div>
      </div>
    );
  }

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
