import { Link } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="container-page not-found__container">
        <div className="card not-found__card">
          <div className="not-found__code">404</div>
          <div className="muted not-found__msg">Trang không tồn tại.</div>
          <Link className="btn-primary not-found__cta" to="/">
          Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
