import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AdminShops from "./AdminShops";
import AdminShopReports from "./AdminShopReports";

import "./AdminShopCenter.css";

export default function AdminShopCenter() {
  const [params, setParams] = useSearchParams();

  const tab = useMemo(() => {
    const t = params.get("tab");
    return t === "reports" ? "reports" : "shops";
  }, [params]);

  return (
    <section className="admin-shop-center">
      <div className="admin-shop-center__tabs card">
        <button
          type="button"
          className={tab === "shops" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
          onClick={() => setParams({ tab: "shops" })}
        >
          Quản trị shop
        </button>
        <button
          type="button"
          className={tab === "reports" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
          onClick={() => setParams({ tab: "reports" })}
        >
          Báo cáo shop
        </button>
      </div>

      {tab === "reports" ? <AdminShopReports /> : <AdminShops />}
    </section>
  );
}
