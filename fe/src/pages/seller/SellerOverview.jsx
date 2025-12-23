import { useEffect, useState } from "react";
import { sellerApi } from "../../api/seller";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function SellerOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await sellerApi.analyticsSummary();
        if (mounted) setData(res?.data || null);
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
    <div>
      <h1 className="text-xl font-semibold">Tổng quan</h1>
      <p className="muted text-sm mt-1">Theo dõi doanh thu, đơn hàng và hiệu suất shop.</p>

      {error ? <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="mt-6 muted">Đang tải...</div>
      ) : data ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Doanh thu" value={formatVND(data.revenue)} />
          <Stat label="Số đơn" value={data.orders} />
          <Stat label="Sản phẩm" value={data.products} />
          <Stat label="Tồn kho" value={data.stock} />
        </div>
      ) : (
        <div className="mt-6 muted">Chưa có dữ liệu.</div>
      )}

      <div className="mt-6 card p-6">
        <div className="font-semibold">Gợi ý vận hành</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Đảm bảo tồn kho luôn cập nhật để tránh huỷ đơn.</li>
          <li>Đọc và phản hồi đánh giá để tăng uy tín shop.</li>
          <li>Ưu tiên xác nhận đơn nhanh để tăng tỉ lệ hoàn thành.</li>
        </ul>
      </div>
    </div>
  );
}
