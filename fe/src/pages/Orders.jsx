import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { customerApi } from "../api/customer";

function formatVND(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "₫";
}

function StatusBadge({ status }) {
  const map = {
    PLACED: "Đã đặt",
    CONFIRMED: "Đã xác nhận",
    PACKING: "Đang chuẩn bị",
    SHIPPED: "Đang giao",
    DELIVERED: "Đã giao",
    COMPLETED: "Hoàn tất",
    CANCELLED: "Đã hủy",
    RETURN_REQUESTED: "Yêu cầu hoàn",
    RETURNED: "Đã hoàn",
    REFUND_REQUESTED: "Yêu cầu hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
  };
  const label = map[status] || status;
  const cls =
    status === "COMPLETED" || status === "DELIVERED"
      ? "bg-emerald-50 text-emerald-700"
      : status === "CANCELLED"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await customerApi.listOrders({ page, limit: 15 });
        if (res?.success) {
          setData(res.data);
          setError(null);
        } else {
          setError(res?.message || "Không tải được đơn hàng");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  function setPage(p) {
    const sp = new URLSearchParams(searchParams);
    sp.set("page", String(p));
    setSearchParams(sp);
  }

  const justOrdered = location.state?.justOrdered;
  const justOrders = location.state?.orders || [];

  return (
    <div className="container-page py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Đơn hàng của tôi</h1>
          <p className="muted text-sm">Theo dõi trạng thái giao hàng, yêu cầu hủy / hoàn hàng.</p>
        </div>
        <Link to="/products" className="btn-secondary">Tiếp tục mua sắm</Link>
      </div>

      {justOrdered ? (
        <div className="mt-4 card p-4 bg-emerald-50 border-emerald-100 text-emerald-800">
          <div className="font-medium">Đặt hàng thành công!</div>
          {justOrders.length ? (
            <div className="mt-1 text-sm">Mã đơn: {justOrders.map((o) => o.code).join(", ")}</div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="card p-6">Đang tải...</div>
        ) : error ? (
          <div className="card p-6 text-red-600">{error}</div>
        ) : data.items?.length ? (
          <div className="space-y-4">
            {data.items.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.code}`}
                className="card p-5 block hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm muted">Mã đơn</div>
                    <div className="font-semibold">{o.code}</div>
                    <div className="muted text-sm mt-1">{o.shop?.name || ""}</div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={o.status} />
                    <div className="mt-2 font-semibold">{formatVND(o.total)}</div>
                    <div className="muted text-xs">{new Date(o.createdAt).toLocaleString("vi-VN")}</div>
                  </div>
                </div>
              </Link>
            ))}

            <div className="flex items-center justify-between">
              <button className="btn-secondary" disabled={data.pagination.page <= 1} onClick={() => setPage(data.pagination.page - 1)}>
                Trang trước
              </button>
              <div className="text-sm text-slate-600">Trang {data.pagination.page} / {data.pagination.totalPages}</div>
              <button
                className="btn-secondary"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => setPage(data.pagination.page + 1)}
              >
                Trang sau
              </button>
            </div>
          </div>
        ) : (
          <div className="card p-6">Bạn chưa có đơn hàng nào.</div>
        )}
      </div>
    </div>
  );
}
