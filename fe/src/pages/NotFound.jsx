import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="container-page py-16">
      <div className="card p-8 text-center">
        <div className="text-5xl font-bold">404</div>
        <div className="muted mt-2">Trang không tồn tại.</div>
        <Link className="btn-primary mt-6 inline-flex" to="/">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
