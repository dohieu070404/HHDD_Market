import { Link } from "react-router-dom";
import "./Guide.css";

function AccountRow({ label, value }) {
  return (
    <div className="guide-accountRow">
      <span className="guide-accountRow__label">{label}</span>
      <span className="guide-accountRow__value">{value}</span>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="guide-page">
      <div className="container-page guide-page__container">
        <div className="guide-header">
          <div>
            <h1 className="guide-header__title">Hướng dẫn sử dụng</h1>
            <p className="guide-header__subtitle muted">
              Trang này tổng hợp cách sử dụng nhanh cho Người mua, Người bán và Admin.
            </p>
          </div>
          <Link to="/" className="btn-secondary">
            ← Về trang chủ
          </Link>
        </div>

        <div className="guide-grid">
          <section className="card guide-section">
            <h2 className="guide-section__title">Tài khoản mẫu</h2>
            <p className="guide-section__desc muted">
              Nếu bạn chạy seed database, hệ thống có sẵn các tài khoản sau để bạn kiểm thử nhanh.
            </p>
            <div className="guide-accountList">
              <AccountRow label="Người mua" value="customer@shop.local / Customer@123" />
              <AccountRow label="Người bán" value="seller@shop.local / Seller@123" />
              <AccountRow label="Người bán (Gia dụng)" value="seller.giadung@shop.local / Seller@123" />
              <AccountRow label="Người bán (Mỹ phẩm)" value="seller.beauty@shop.local / Seller@123" />
              <AccountRow label="Người bán (Thời trang)" value="seller.fashion@shop.local / Seller@123" />
              <AccountRow label="Admin" value="admin@shop.local / Admin@123" />
              <AccountRow label="CS" value="cs@shop.local / Cs@12345" />
            </div>
            <div className="guide-section__hint muted">
              Lưu ý: Đây là tài khoản demo phục vụ kiểm thử, bạn có thể tự đăng ký tài khoản mới.
            </div>
          </section>

          <section className="card guide-section">
            <h2 className="guide-section__title">Người mua</h2>
            <ol className="guide-list guide-list--ordered">
              <li>Vào mục <b>Sản phẩm</b> để tìm kiếm, lọc và sắp xếp sản phẩm.</li>
              <li>Chọn biến thể (SKU) và <b>Thêm vào giỏ</b>.</li>
              <li>Vào <b>Giỏ hàng</b> → <b>Thanh toán</b> để tạo đơn hàng.</li>
              <li>Vào <b>Đơn hàng</b> để xem chi tiết, theo dõi vận chuyển và xác nhận đã nhận hàng.</li>
              <li>Sau khi đơn ở trạng thái <b>Đã giao/Hoàn tất</b>, bạn có thể gửi <b>Yêu cầu hoàn/đổi</b> hoặc <b>Đánh giá</b>.</li>
            </ol>
          </section>

          <section className="card guide-section">
            <h2 className="guide-section__title">Mở shop & Người bán</h2>
            <ol className="guide-list guide-list--ordered">
              <li>Đăng nhập tài khoản người mua.</li>
              <li>Vào <b>Mở shop</b> và gửi hồ sơ.</li>
              <li>Chờ Admin duyệt. Khi được duyệt, bạn truy cập <b>Trung tâm bán hàng</b> để quản lý.</li>
              <li>Trong Trung tâm bán hàng: thêm/sửa sản phẩm, quản lý đơn hàng, tạo vận đơn và cập nhật trạng thái.</li>
            </ol>
          </section>

          <section className="card guide-section">
            <h2 className="guide-section__title">Admin</h2>
            <ol className="guide-list guide-list--ordered">
              <li>Vào <b>Quản trị</b> để duyệt hồ sơ mở shop (duyệt / từ chối).</li>
              <li>Quản lý danh mục sản phẩm.</li>
              <li>Giám sát vận hành (đơn hàng, khiếu nại, đánh giá).</li>
            </ol>
          </section>

          <section className="card guide-section">
            <h2 className="guide-section__title">Mẹo sử dụng</h2>
            <ul className="guide-list guide-list--unordered">
              <li>Nếu bạn không thấy dữ liệu, hãy kiểm tra backend đã seed DB chưa.</li>
              <li>Khi gặp lỗi, hệ thống sẽ hiển thị thông báo tiếng Việt trên giao diện.</li>
              <li>Nếu cần reset dữ liệu demo: tắt docker và xoá volume DB, rồi chạy lại compose.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
