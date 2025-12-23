import RequireAuth from "./RequireAuth";
import { useAuth } from "../../contexts/AuthContext";

export default function RequireRole({ roles, children }) {
  const { user, booting } = useAuth();
  const ok = user && roles.includes(user.role);

  if (booting) {
    return (
      <RequireAuth>
        <div className="container-page py-10">
          <div className="card p-6">Đang tải...</div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      {ok ? (
        children
      ) : (
        <div className="container-page py-10">
          <div className="card p-6">
            <h1 className="text-lg font-semibold">Không có quyền truy cập</h1>
            <p className="muted mt-2">Tài khoản của bạn không có quyền vào khu vực này.</p>
          </div>
        </div>
      )}
    </RequireAuth>
  );
}
