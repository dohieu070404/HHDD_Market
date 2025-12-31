import { request } from "./client";

function qs(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const publicApi = {
  home: () => request("/public/home", { auth: false }),
  listCategories: () => request("/public/categories", { auth: false }),
  listProducts: ({ q, category, shop, sort, minPrice, maxPrice, minRating, page = 1, limit = 12 } = {}) =>
    request(`/public/products${qs({ q, category, shop, sort, minPrice, maxPrice, minRating, page, limit })}`, { auth: false }),
  getProduct: (slug) => request(`/public/products/${encodeURIComponent(slug)}`, { auth: false }),
  similarProducts: (slug, { limit = 8 } = {}) =>
    request(`/public/products/${encodeURIComponent(slug)}/similar${qs({ limit })}`, { auth: false }),
  productReviews: (productId, { page = 1, limit = 10 } = {}) =>
    request(`/public/products/${productId}/reviews${qs({ page, limit })}`, { auth: false }),
  getShop: (slug) => request(`/public/shops/${encodeURIComponent(slug)}`, { auth: false }),
};
