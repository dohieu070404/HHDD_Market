const { prisma } = require("../lib/prisma");

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}

function isVoucherWindowActive(v, now = new Date()) {
  if (!v) return false;
  if (v.isActive === false) return false;
  if (v.startAt && v.startAt > now) return false;
  if (v.endAt && v.endAt < now) return false;
  return true;
}

function calcVoucherDiscount(v, subtotal) {
  if (!v || subtotal <= 0) return 0;
  let discount = 0;
  if (v.type === "PERCENT") {
    discount = Math.floor((subtotal * Number(v.value || 0)) / 100);
    if (v.maxDiscount != null) {
      discount = Math.min(discount, Number(v.maxDiscount));
    }
  } else {
    discount = Number(v.value || 0);
  }
  discount = Math.max(0, discount);
  return Math.min(discount, subtotal);
}

async function getUserSpendPlatform(userId, { since, tx } = {}) {
  const client = tx || prisma;
  const result = await client.order.aggregate({
    where: {
      userId,
      status: { in: ["DELIVERED", "COMPLETED"] },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    _sum: { total: true },
  });
  return Number(result?._sum?.total || 0);
}

async function getUserSpendShop(userId, shopId, { since, tx } = {}) {
  const client = tx || prisma;
  const result = await client.order.aggregate({
    where: {
      userId,
      shopId,
      status: { in: ["DELIVERED", "COMPLETED"] },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    _sum: { total: true },
  });
  return Number(result?._sum?.total || 0);
}

/**
 * Evaluate a platform voucher against current context.
 * Returns: { ok, voucher, discount, reason }
 */
async function validatePlatformVoucherByCode({ code, subtotal, userId, tx }) {
  if (!code) return { ok: true, voucher: null, discount: 0 };
  const client = tx || prisma;
  const voucher = await client.voucher.findUnique({ where: { code } });
  return validatePlatformVoucherRecord({ voucher, subtotal, userId, tx: client });
}

async function validatePlatformVoucherById({ id, subtotal, userId, tx }) {
  if (!id) return { ok: true, voucher: null, discount: 0 };
  const client = tx || prisma;
  const voucher = await client.voucher.findUnique({ where: { id } });
  return validatePlatformVoucherRecord({ voucher, subtotal, userId, tx: client });
}

async function validatePlatformVoucherRecord({ voucher, subtotal, userId, tx }) {
  if (!voucher) return { ok: false, voucher: null, discount: 0, reason: "Voucher không hợp lệ" };
  const now = new Date();
  if (!isVoucherWindowActive(voucher, now)) {
    return { ok: false, voucher: null, discount: 0, reason: "Voucher không còn hiệu lực" };
  }
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    return { ok: false, voucher: null, discount: 0, reason: "Voucher đã hết lượt" };
  }
  if (subtotal < Number(voucher.minSubtotal || 0)) {
    return { ok: false, voucher: null, discount: 0, reason: "Chưa đạt giá trị tối thiểu" };
  }

  // Loyalty checks
  const minMonth = Number(voucher.minBuyerSpendMonth || 0);
  const minYear = Number(voucher.minBuyerSpendYear || 0);
  if ((minMonth > 0 || minYear > 0) && userId) {
    if (minMonth > 0) {
      const spendMonth = await getUserSpendPlatform(userId, { since: startOfMonth(now), tx });
      if (spendMonth < minMonth) {
        return {
          ok: false,
          voucher: null,
          discount: 0,
          reason: `Cần tổng mua trong tháng ≥ ${minMonth.toLocaleString("vi-VN")}₫`,
        };
      }
    }
    if (minYear > 0) {
      const spendYear = await getUserSpendPlatform(userId, { since: startOfYear(now), tx });
      if (spendYear < minYear) {
        return {
          ok: false,
          voucher: null,
          discount: 0,
          reason: `Cần tổng mua trong năm ≥ ${minYear.toLocaleString("vi-VN")}₫`,
        };
      }
    }
  }

  const discount = calcVoucherDiscount(voucher, subtotal);
  return { ok: true, voucher, discount };
}

/**
 * Evaluate a shop voucher for a specific shop.
 * Returns: { ok, voucher, discount, reason }
 */
async function validateShopVoucherByCode({ code, shopId, subtotal, userId, tx }) {
  if (!code) return { ok: true, voucher: null, discount: 0 };
  const client = tx || prisma;
  const voucher = await client.shopVoucher.findUnique({ where: { code } });
  return validateShopVoucherRecord({ voucher, shopId, subtotal, userId, tx: client });
}

async function validateShopVoucherById({ id, shopId, subtotal, userId, tx }) {
  if (!id) return { ok: true, voucher: null, discount: 0 };
  const client = tx || prisma;
  const voucher = await client.shopVoucher.findUnique({ where: { id } });
  return validateShopVoucherRecord({ voucher, shopId, subtotal, userId, tx: client });
}

async function validateShopVoucherRecord({ voucher, shopId, subtotal, userId, tx }) {
  if (!voucher) return { ok: false, voucher: null, discount: 0, reason: "Voucher shop không hợp lệ" };
  if (Number(voucher.shopId) !== Number(shopId)) {
    return { ok: false, voucher: null, discount: 0, reason: "Voucher không thuộc shop" };
  }
  const now = new Date();
  if (!isVoucherWindowActive(voucher, now)) {
    return { ok: false, voucher: null, discount: 0, reason: "Voucher shop không còn hiệu lực" };
  }
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    return { ok: false, voucher: null, discount: 0, reason: "Voucher shop đã hết lượt" };
  }
  if (subtotal < Number(voucher.minSubtotal || 0)) {
    return { ok: false, voucher: null, discount: 0, reason: "Chưa đạt giá trị tối thiểu" };
  }

  // Loyalty checks
  const minMonth = Number(voucher.minBuyerSpendMonth || 0);
  const minYear = Number(voucher.minBuyerSpendYear || 0);
  if ((minMonth > 0 || minYear > 0) && userId) {
    if (minMonth > 0) {
      const spendMonth = await getUserSpendShop(userId, shopId, { since: startOfMonth(now), tx });
      if (spendMonth < minMonth) {
        return {
          ok: false,
          voucher: null,
          discount: 0,
          reason: `Cần tổng mua shop trong tháng ≥ ${minMonth.toLocaleString("vi-VN")}₫`,
        };
      }
    }
    if (minYear > 0) {
      const spendYear = await getUserSpendShop(userId, shopId, { since: startOfYear(now), tx });
      if (spendYear < minYear) {
        return {
          ok: false,
          voucher: null,
          discount: 0,
          reason: `Cần tổng mua shop trong năm ≥ ${minYear.toLocaleString("vi-VN")}₫`,
        };
      }
    }
  }

  const discount = calcVoucherDiscount(voucher, subtotal);
  return { ok: true, voucher, discount };
}

module.exports = {
  startOfMonth,
  startOfYear,
  isVoucherWindowActive,
  calcVoucherDiscount,
  getUserSpendPlatform,
  getUserSpendShop,
  validatePlatformVoucherByCode,
  validatePlatformVoucherById,
  validateShopVoucherByCode,
  validateShopVoucherById,
};
