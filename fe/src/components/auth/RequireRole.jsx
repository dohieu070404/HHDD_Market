import RequireAuth from "./RequireAuth";
import { useAuth } from "../../contexts/AuthContext";
import "./authGuard.css";

export default function RequireRole({ roles, children }) {
  const { user, booting } = useAuth();
  const ok = user && roles.includes(user.role);

  if (booting) {
    return (
      <RequireAuth>
        <div className="auth-guard">
          <div className="container-page auth-guard__container">
            <div className="card auth-guard__card">Đang tải...</div>
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      {ok ? (
        children
      ) : (
        <div className="auth-guard">
          <div className="container-page auth-guard__container">
            <div className="card auth-guard__card">
              <h1 className="auth-guard__title">Không có quyền truy cập</h1>
              <p className="auth-guard__desc muted">Tài khoản của bạn không có quyền vào khu vực này.</p>
            </div>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
