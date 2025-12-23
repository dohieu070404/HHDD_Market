import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function RequireAuth({ children }) {
  const { token, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="container-page py-10">
        <div className="card p-6">Đang tải...</div>
      </div>
    );
  }

  if (!token) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return children;
}
