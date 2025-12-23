const ORDERS_KEY = "shop_orders_v1";

function load() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
}

export function listOrders() {
  const list = load();
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOrderById(id) {
  return load().find((o) => o.id === id);
}

export function createOrder({ items, shipping, payment, totals }) {
  const now = new Date();
  const order = {
    id: `OD${now.getTime()}`,
    createdAt: now.toISOString(),
    status: "NEW",
    items,
    shipping,
    payment,
    totals,
  };

  const next = [order, ...load()];
  save(next);
  return order;
}

export function updateOrderStatus(id, status) {
  const list = load();
  const idx = list.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], status };
  save(list);
  return list[idx];
}

export function clearOrders() {
  save([]);
}
