import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);
const CART_KEY_PREFIX = "shop_cart_v2";

function cartKeyForUser(userId) {
  if (!userId) return `${CART_KEY_PREFIX}_guest`;
  return `${CART_KEY_PREFIX}_${userId}`;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider />");
  return ctx;
}

function loadCart(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const [storageKey, setStorageKey] = useState(() => cartKeyForUser(userId));
  const prevKeyRef = useRef(storageKey);

  const [items, setItems] = useState(() => loadCart(cartKeyForUser(userId)));

  // When user changes (login/logout/switch account) => switch storage key.
  useEffect(() => {
    const nextKey = cartKeyForUser(userId);
    if (nextKey === prevKeyRef.current) return;

    // Persist current cart to previous key
    try {
      localStorage.setItem(prevKeyRef.current, JSON.stringify(items));
    } catch {
      // ignore
    }

    // Load cart for new user
    const nextItems = loadCart(nextKey);
    setItems(nextItems);
    setStorageKey(nextKey);
    prevKeyRef.current = nextKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

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

    const incoming = {
      ...item,
      skuId,
      // ép kiểu để tránh undefined/string rỗng
      price: item.price == null ? 0 : Number(item.price),
    };

    setItems((prev) => {
      const idx = prev.findIndex((p) => Number(p.skuId) === skuId);

      if (idx >= 0) {
        const next = [...prev];
        const prevQty = Number(next[idx].qty || 0);
        //  merge dữ liệu mới (price, name, thumb...) + tăng qty
        next[idx] = { ...next[idx], ...incoming, qty: prevQty + Number(qty || 1) };
        return next;
      }

      return [...prev, { ...incoming, qty: Number(qty || 1) }];
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

  const value = useMemo(
    () => ({
      items,
      itemCount,
      count: itemCount, // backward compat for some components
      subtotal,
      addItem,
      removeItem,
      setQty,
      clear,
    }),
    [items, itemCount, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
