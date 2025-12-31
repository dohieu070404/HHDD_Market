import { useEffect, useState } from "react";
import { sellerApi } from "../../api/seller";
import { formatVnd } from "../../utils/format";

import "./SellerOverview.css";

function Stat({ label, value }) {
  return (
    <div className="card seller-overview__stat">
      <div className="seller-overview__statLabel">{label}</div>
      <div className="seller-overview__statValue">{value}</div>
    </div>
  );
}

export default function SellerOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [kpiRes, fRes] = await Promise.all([sellerApi.getDashboardKPI(), sellerApi.getFinanceSummary()]);
        if (mounted) {
          setData(kpiRes?.success ? (kpiRes.data || null) : null);
          setFinance(fRes?.success ? (fRes.data || null) : null);
        }
      } catch (e) {
        if (mounted) setError(e?.message || "Không load được báo cáo");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="seller-overview">
      <header className="seller-overview__header">
        <h1 className="seller-overview__title">Tổng quan</h1>
        <p className="seller-overview__subtitle muted">Theo dõi doanh thu, đơn hàng và hiệu suất shop.</p>
      </header>

      {error ? <div className="alert alert--danger seller-overview__alert">{error}</div> : null}

      {loading ? (
        <div className="seller-overview__loading muted">Đang tải...</div>
      ) : data ? (
        <div className="seller-overview__stats">
          <Stat label="Doanh thu" value={formatVnd(data.revenue)} />
          <Stat label="Lợi nhuận ước tính" value={formatVnd(data.profit)} />
          <Stat label="Số đơn" value={data.orders} />
          <Stat label="Sản phẩm" value={data.products} />
          <Stat label="Tồn kho" value={data.stock} />
        </div>
      ) : (
        <div className="seller-overview__empty muted">Chưa có dữ liệu.</div>
      )}

      {finance ? (
        <div className="card seller-overview__finance">
          <div className="seller-overview__financeTitle">Chi tiết lợi nhuận (ước tính)</div>
          <div className="seller-overview__financeGrid">
            <div>
              <div className="seller-overview__financeLabel">Doanh thu hàng hoá</div>
              <div className="seller-overview__financeValue">{formatVnd(finance.grossMerchRevenue)}</div>
            </div>
            <div>
              <div className="seller-overview__financeLabel">Giảm giá/Voucher</div>
              <div className="seller-overview__financeValue">- {formatVnd(finance.voucherDiscount)}</div>
            </div>
            <div>
              <div className="seller-overview__financeLabel">Phí sàn (15%)</div>
              <div className="seller-overview__financeValue">- {formatVnd(finance.platformFee)}</div>
            </div>
            <div>
              <div className="seller-overview__financeLabel">Giá nhập (COGS)</div>
              <div className="seller-overview__financeValue">- {formatVnd(finance.cogs)}</div>
            </div>
          </div>
          <div className="seller-overview__financeTotal">
            <div className="seller-overview__financeTotalLabel">Lợi nhuận</div>
            <div className="seller-overview__financeTotalValue">{formatVnd(finance.profit)}</div>
          </div>
        </div>
      ) : null}

      <div className="card seller-overview__tips">
        <div className="seller-overview__tipsTitle">Gợi ý vận hành</div>
        <ul className="seller-overview__tipsList">
          <li>Đảm bảo tồn kho luôn cập nhật để tránh huỷ đơn.</li>
          <li>Đọc và phản hồi đánh giá để tăng uy tín shop.</li>
          <li>Ưu tiên xác nhận đơn nhanh để tăng tỉ lệ hoàn thành.</li>
        </ul>
      </div>
    </section>
  );
}
