import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const CART_KEY = "shop_cart_v2";

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider />");
  return ctx;
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadCart());

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const itemCount = useMemo(() => items.reduce((sum, it) => sum + Number(it.qty || 0), 0), [items]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.qty || 0), 0),
    [items]
  );

  /**
   * Add 1 item into cart.
   * Item identity is skuId (variant) to avoid "missing product code" errors on checkout.
   */
  function addItem(item, qty = 1) {
    const skuId = Number(item.skuId);
    if (!skuId) return;

    setItems((prev) => {
      const idx = prev.findIndex((p) => Number(p.skuId) === skuId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty || 0) + Number(qty || 1) };
        return next;
      }

      return [...prev, { ...item, skuId, qty: Number(qty || 1) }];
    });
  }

  function removeItem(skuId) {
    setItems((prev) => prev.filter((it) => Number(it.skuId) !== Number(skuId)));
  }

  function setQty(skuId, qty) {
    const n = Math.max(1, Number(qty || 1));
    setItems((prev) => prev.map((it) => (Number(it.skuId) === Number(skuId) ? { ...it, qty: n } : it)));
  }

  function clear() {
    setItems([]);
  }

  const value = useMemo(() => ({ items, itemCount, subtotal, addItem, removeItem, setQty, clear }), [items, itemCount, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
