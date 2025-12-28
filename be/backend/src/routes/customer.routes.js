const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth.middleware");
const { withIdempotency } = require("../middleware/idempotency.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { z } = require("zod");
const { imageUpload } = require("../middleware/upload.middleware");

const { createPaymentForOrder } = require("../services/payment.service");
const { notify } = require("../services/notification.service");
const { recalcProductRating, recalcShopRating } = require("../services/rating.service");
const {
  validatePlatformVoucherByCode,
  validatePlatformVoucherById,
  validateShopVoucherByCode,
  validateShopVoucherById,
  isVoucherWindowActive,
  calcVoucherDiscount,
  getUserSpendPlatform,
  getUserSpendShop,
  startOfMonth,
  startOfYear,
} = require("../services/voucher.service");

// All customer routes require login
router.use(requireAuth);

// --- Helpers (inventory / safety) ---
// Restock SKU stock and rollback soldCount when an order is cancelled.
// Must be executed inside a transaction.
async function restockOrderItems(tx, orderId) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { skuId: true, qty: true, productId: true },
  });
  for (const it of items) {
    await tx.sKU.update({ where: { id: it.skuId }, data: { stock: { increment: it.qty } } });
    // rollback soldCount increment done at checkout commit
    await tx.product.update({ where: { id: it.productId }, data: { soldCount: { decrement: it.qty } } });
  }
}

// --- Profile ---
router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, username: true, name: true, phone: true, avatarUrl: true, role: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  })
);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(30).optional(),
  avatarUrl: z.string().url().optional(),
});

router.put(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: { name: body.name, phone: body.phone, avatarUrl: body.avatarUrl },
      select: { id: true, email: true, username: true, name: true, phone: true, avatarUrl: true, role: true, createdAt: true },
    });
    res.json({ success: true, message: "Cập nhật hồ sơ thành công", data: user });
  })
);

// Upload avatar (multipart/form-data)
// field name: avatar
router.post(
  "/profile/avatar",
  imageUpload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "Thiếu file avatar");
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: { avatarUrl },
      select: { id: true, email: true, username: true, name: true, phone: true, avatarUrl: true, role: true, createdAt: true },
    });
    res.json({ success: true, message: "Đã cập nhật ảnh đại diện", data: user });
  })
);

// Upload images for reviews (multipart/form-data)
// field name: reviewImages
router.post(
  "/uploads/review-images",
  imageUpload.array("reviewImages", 6),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw httpError(400, "Thiếu file ảnh");
    const urls = files.map((f) => `/uploads/reviews/${f.filename}`);
    res.json({ success: true, data: { urls } });
  })
);

// Upload images for disputes/complaints (multipart/form-data)
// field name: disputeImages
router.post(
  "/uploads/dispute-images",
  imageUpload.array("disputeImages", 6),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw httpError(400, "Thiếu file ảnh");
    const urls = files.map((f) => `/uploads/disputes/${f.filename}`);
    res.json({ success: true, data: { urls } });
  })
);

// --- Addresses ---
const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(6),
  line1: z.string().min(1),
  line2: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// --- Report shop (buyer safety) ---
const shopReportSchema = z.object({
  reason: z.string().trim().min(3).max(100),
  category: z.string().trim().min(2).max(30).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  description: z.string().trim().min(3).max(2000).optional(),
});

router.get(
  "/addresses",
  asyncHandler(async (req, res) => {
    const list = await prisma.address.findMany({
      where: { userId: req.user.sub },
      orderBy: [{ isDefault: "desc" }, { id: "desc" }],
    });
    res.json({ success: true, data: list });
  })
);

// Notifications (for customer UI)
router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const list = await prisma.notification.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ success: true, data: list });
  })
);

router.put(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const noti = await prisma.notification.findFirst({ where: { id, userId: req.user.sub } });
    if (!noti) throw httpError(404, "Không tìm thấy thông báo");
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.json({ success: true });
  })
);

router.post(
  "/addresses",
  asyncHandler(async (req, res) => {
    const body = addressSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.address.updateMany({
          where: { userId: req.user.sub },
          data: { isDefault: false },
        });
      }
      return tx.address.create({
        data: {
          userId: req.user.sub,
          fullName: body.fullName,
          phone: body.phone,
          line1: body.line1,
          line2: body.line2,
          ward: body.ward,
          district: body.district,
          city: body.city,
          province: body.province,
          country: body.country || "VN",
          postalCode: body.postalCode,
          isDefault: body.isDefault || false,
        },
      });
    });

    res.status(201).json({ success: true, message: "Đã thêm địa chỉ", data: created });
  })
);

router.put(
  "/addresses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = addressSchema.partial().parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const addr = await tx.address.findFirst({ where: { id, userId: req.user.sub } });
      if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");

      if (body.isDefault) {
        await tx.address.updateMany({ where: { userId: req.user.sub }, data: { isDefault: false } });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...body,
        },
      });
    });

    res.json({ success: true, message: "Đã cập nhật địa chỉ", data: updated });
  })
);

router.delete(
  "/addresses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const addr = await prisma.address.findFirst({ where: { id, userId: req.user.sub } });
    if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");
    await prisma.address.delete({ where: { id } });
    res.json({ success: true, message: "Đã xoá địa chỉ" });
  })
);

router.post(
  "/addresses/:id/default",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const addr = await prisma.address.findFirst({ where: { id, userId: req.user.sub } });
    if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");

    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId: req.user.sub }, data: { isDefault: false } }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);

    res.json({ success: true, message: "Đã đặt làm mặc định" });
  })
);

// --- Shop reports ---
router.post(
  "/shops/:slug/report",
  asyncHandler(async (req, res) => {
    const slug = (req.params.slug || "").toString();
    const body = shopReportSchema.parse(req.body);

    const shop = await prisma.shop.findUnique({ where: { slug } });
    if (!shop) throw httpError(404, "Không tìm thấy shop");

    // Prevent spam: only 1 report per shop per user per 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await prisma.shopReport.findFirst({
      where: { shopId: shop.id, reporterId: req.user.sub, createdAt: { gte: since } },
      select: { id: true, createdAt: true },
    });
    if (recent) throw httpError(400, "Bạn đã báo cáo shop này gần đây. Vui lòng chờ xử lý.");

    // Anti-abuse: mark whether this report is from a verified buyer (has a delivered/completed order from this shop)
    const verified = await prisma.order.findFirst({
      where: {
        userId: req.user.sub,
        shopId: shop.id,
        status: { in: ["DELIVERED", "COMPLETED"] },
      },
      select: { id: true },
    });

    const created = await prisma.shopReport.create({
      data: {
        shopId: shop.id,
        reporterId: req.user.sub,
        reason: body.reason,
        category: body.category || null,
        severity: body.severity || "LOW",
        isVerifiedPurchase: !!verified,
        description: body.description || null,
      },
    });

    // Note: We intentionally do NOT auto-suspend on raw report count to prevent report-abuse.
    // Enforcement decisions are based on validated report ratio + moderation points.

    res.status(201).json({ success: true, message: "Đã gửi báo cáo", data: { id: created.id } });
  })
);

// --- Wishlist ---
router.get(
  "/wishlist",
  asyncHandler(async (req, res) => {
    const list = await prisma.wishlistItem.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      include: { product: { include: { shop: { select: { id: true, name: true, slug: true } } } } },
    });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/wishlist/:productId",
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user.sub, productId } },
      update: {},
      create: { userId: req.user.sub, productId },
    });
    res.status(201).json({ success: true, message: "Đã thêm vào wishlist" });
  })
);

router.delete(
  "/wishlist/:productId",
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    await prisma.wishlistItem.deleteMany({ where: { userId: req.user.sub, productId } });
    res.json({ success: true, message: "Đã xoá khỏi wishlist" });
  })
);

// --- Cart (server-side) ---
async function getOrCreateCart(userId) {
  const cart = await prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return cart;
}

router.get(
  "/cart",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.sub);
    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        sku: {
          include: {
            product: { include: { shop: { select: { id: true, name: true, slug: true } } } },
          },
        },
      },
      orderBy: { id: "desc" },
    });

    res.json({ success: true, data: { cartId: cart.id, items } });
  })
);

const addCartItemSchema = z.object({
  skuId: z.number().int().positive(),
  qty: z.number().int().positive().max(99).default(1),
});

router.post(
  "/cart/items",
  asyncHandler(async (req, res) => {
    const body = addCartItemSchema.parse(req.body);
    const cart = await getOrCreateCart(req.user.sub);

    const sku = await prisma.sKU.findUnique({
      where: { id: body.skuId },
      include: { product: true },
    });
    if (!sku || sku.status !== "ACTIVE" || sku.product.status !== "ACTIVE") {
      throw httpError(404, "SKU không tồn tại");
    }

    // Upsert qty
    const item = await prisma.cartItem.upsert({
      where: { cartId_skuId: { cartId: cart.id, skuId: body.skuId } },
      update: { qty: { increment: body.qty } },
      create: { cartId: cart.id, skuId: body.skuId, qty: body.qty },
    });

    res.status(201).json({ success: true, message: "Đã thêm vào giỏ", data: item });
  })
);

const updateCartQtySchema = z.object({
  qty: z.number().int().positive().max(99),
});

router.patch(
  "/cart/items/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateCartQtySchema.parse(req.body);
    const cart = await getOrCreateCart(req.user.sub);
    const item = await prisma.cartItem.findFirst({ where: { id, cartId: cart.id } });
    if (!item) throw httpError(404, "Không tìm thấy item");
    const updated = await prisma.cartItem.update({ where: { id }, data: { qty: body.qty } });
    res.json({ success: true, message: "Đã cập nhật giỏ", data: updated });
  })
);

router.delete(
  "/cart/items/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const cart = await getOrCreateCart(req.user.sub);
    const item = await prisma.cartItem.findFirst({ where: { id, cartId: cart.id } });
    if (!item) throw httpError(404, "Không tìm thấy item");
    await prisma.cartItem.delete({ where: { id } });
    res.json({ success: true, message: "Đã xoá khỏi giỏ" });
  })
);

router.post(
  "/cart/clear",
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.sub);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    res.json({ success: true, message: "Đã xoá giỏ" });
  })
);

// --- Shipping fee estimate (demo) ---
router.get(
  "/shipping/estimate",
  asyncHandler(async (req, res) => {
    // Demo: flat fee
    const subtotal = Number(req.query.subtotal || 0);
    const fee = subtotal >= 500000 ? 0 : 25000;
    res.json({ success: true, data: { shippingFee: fee, currency: "VND" } });
  })
);

// --- Checkout ---
const checkoutSchema = z.object({
  // Nếu không gửi items -> lấy từ cart
  items: z
    .array(
      z.object({
        skuId: z.number().int().positive(),
        qty: z.number().int().positive().max(99),
      })
    )
    .optional(),
  addressId: z.number().int().positive().optional(),
  shipping: z
    .object({
      fullName: z.string().min(1),
      phone: z.string().min(6),
      line1: z.string().min(1),
      line2: z.string().optional(),
      ward: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
    })
    .optional(),
  paymentMethod: z.enum(["COD", "BANK_TRANSFER", "MOCK_GATEWAY"]).default("COD"),
  voucherCode: z.string().trim().optional(),
  note: z.string().max(500).optional(),
});

function genOrderCode() {
  return `OD${Date.now()}${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

function genGroupCode() {
  return `GR${Date.now()}${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

function calcItemPrice(sku, product) {
  const unitPrice = sku.price != null ? sku.price : product.price;
  return unitPrice;
}

// Backwards-compatible helper used by both legacy and new checkout flows.
// Returns: { ok, voucher, discount, message }
async function resolveVoucher(code, subtotal, userId) {
  if (!code) return { ok: true, voucher: null, discount: 0 };
  const r = await validatePlatformVoucherByCode({ code, subtotal, userId });
  if (!r.ok) return { ok: false, voucher: null, discount: 0, message: r.reason || "Voucher không hợp lệ" };
  return { ok: true, voucher: r.voucher, discount: r.discount };
}



// ---------------------------------------------------------------------------
// NEW CHECKOUT FLOW: Shipping Options -> Draft -> Commit (Idempotent)
// ---------------------------------------------------------------------------

const checkoutDraftSchema = z.object({
  items: z
    .array(
      z.object({
        skuId: z.number().int().positive(),
        qty: z.number().int().positive(),
      })
    )
    .optional(),
  addressId: z.number().int().positive().optional(),
  shipping: z
    .object({
      fullName: z.string().min(2).max(120),
      phone: z.string().min(6).max(20),
      line1: z.string().min(3).max(200),
      line2: z.string().max(200).optional(),
      ward: z.string().max(120).optional(),
      district: z.string().max(120).optional(),
      city: z.string().max(120).optional(),
      province: z.string().max(120).optional(),
      country: z.string().max(2).optional(),
      postalCode: z.string().max(20).optional(),
    })
    .optional(),
  voucherCode: z.string().trim().min(2).max(50).optional(),
  // Optional: apply shop vouchers by shopId.
  shopVouchers: z
    .array(
      z.object({
        shopId: z.number().int().positive(),
        code: z.string().trim().min(2).max(50),
      })
    )
    .optional(),
  note: z.string().max(500).optional(),
});

const draftShippingSchema = z.object({
  shopId: z.number().int().positive(),
  optionCode: z.string().trim().min(1).max(64),
});

const checkoutCommitSchema = z.object({
  draftCode: z.string().trim().min(6).max(64),
  paymentMethod: z.enum(["COD", "BANK_TRANSFER", "MOCK_GATEWAY"]).default("COD"),
});

function genDraftCode() {
  return `DR${Date.now()}${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

function normalizeText(s) {
  return (s || "").toString().trim().toLowerCase();
}

function safeJsonParse(str, fallback) {
  try {
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function parseZonesJson(zonesJson) {
  if (!zonesJson) return [];
  const v = safeJsonParse(zonesJson, []);
  return Array.isArray(v) ? v : [];
}

function zoneMatches(zone, address) {
  if (!zone || typeof zone !== "object") return true;
  const p = normalizeText(zone.province);
  const c = normalizeText(zone.city);
  const d = normalizeText(zone.district);

  if (p && p !== normalizeText(address.province)) return false;
  if (c && c !== normalizeText(address.city)) return false;
  if (d && d !== normalizeText(address.district)) return false;
  return true;
}

function buildShipSnapshotFromAddress(address) {
  return {
    shipFullName: address.fullName,
    shipPhone: address.phone,
    shipLine1: address.line1,
    shipLine2: address.line2 || null,
    shipWard: address.ward || null,
    shipDistrict: address.district || null,
    shipCity: address.city || null,
    shipProvince: address.province || null,
    shipCountry: address.country || "VN",
    shipPostalCode: address.postalCode || null,
  };
}

function draftToAddress(draft) {
  return {
    fullName: draft.shipFullName,
    phone: draft.shipPhone,
    line1: draft.shipLine1,
    line2: draft.shipLine2,
    ward: draft.shipWard,
    district: draft.shipDistrict,
    city: draft.shipCity,
    province: draft.shipProvince,
    country: draft.shipCountry,
    postalCode: draft.shipPostalCode,
  };
}

function calcGroupMetrics(items) {
  let itemCount = 0;
  let totalWeightGram = 0;
  for (const it of items) {
    itemCount += it.qty;
    totalWeightGram += (it.weightGram || 500) * it.qty;
  }
  const weightKg = Math.max(1, Math.ceil(totalWeightGram / 1000));
  return { itemCount, totalWeightGram, weightKg };
}

async function quoteShippingOptionsForGroup({ shopId, subtotal, items, address }) {
  let configs = await prisma.shippingConfig.findMany({
    where: { shopId, isActive: true },
    orderBy: [{ baseFee: "asc" }, { id: "asc" }],
  });

  // If the shop is new and has no shipping config yet, bootstrap a safe default.
  if (configs.length === 0) {
    try {
      await prisma.shippingConfig.createMany({
        data: [
          {
            shopId,
            carrier: "MockCarrier",
            code: "MOCK_STD",
            serviceName: "Giao tiêu chuẩn",
            description: "2-4 ngày (mặc định)",
            isActive: true,
            baseFee: 20000,
            feePerItem: 1000,
            feePerKg: 5000,
            freeShippingOver: 500000,
            minDays: 2,
            maxDays: 4,
            codSupported: true,
            zonesJson: "[]",
          },
          {
            shopId,
            carrier: "MockCarrier",
            code: "MOCK_FAST",
            serviceName: "Giao nhanh",
            description: "1-2 ngày (mặc định)",
            isActive: true,
            baseFee: 35000,
            feePerItem: 1500,
            feePerKg: 7000,
            freeShippingOver: null,
            minDays: 1,
            maxDays: 2,
            codSupported: true,
            zonesJson: "[]",
          },
        ],
        skipDuplicates: true,
      });
    } catch (e) {
      // ignore (race condition / duplicate)
    }
    configs = await prisma.shippingConfig.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ baseFee: "asc" }, { id: "asc" }],
    });
  }

  const metrics = calcGroupMetrics(items);
  const options = [];

  for (const cfg of configs) {
    const zones = parseZonesJson(cfg.zonesJson);
    const zoneOk = zones.length === 0 || zones.some((z) => zoneMatches(z, address));
    if (!zoneOk) continue;

    if (cfg.maxWeightGram != null && metrics.totalWeightGram > cfg.maxWeightGram) continue;

    let fee =
      (cfg.baseFee || 0) +
      (cfg.feePerItem || 0) * metrics.itemCount +
      (cfg.feePerKg || 0) * metrics.weightKg;

    if (cfg.freeShippingOver != null && subtotal >= cfg.freeShippingOver) {
      fee = 0;
    }

    fee = Math.max(0, fee);

    options.push({
      optionId: cfg.code,
      configId: cfg.id,
      carrier: cfg.carrier,
      serviceName: cfg.serviceName,
      description: cfg.description || null,
      fee,
      eta: { minDays: cfg.minDays, maxDays: cfg.maxDays },
      constraints: {
        maxWeightGram: cfg.maxWeightGram ?? null,
        codSupported: cfg.codSupported ?? true,
        zones,
      },
    });
  }

  options.sort((a, b) => a.fee - b.fee);

  if (options.length === 0) {
    return {
      options: [],
      selected: null,
      metrics,
      error: {
        code: "OUT_OF_SERVICE",
        message: "Shop chưa hỗ trợ giao hàng đến địa chỉ đã chọn",
      },
    };
  }

  return { options, selected: options[0], metrics, error: null };
}

function distributeDiscount(groups, discountTotal) {
  const totalSubtotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  if (discountTotal <= 0 || totalSubtotal <= 0) {
    for (const g of groups) g.discount = 0;
    return;
  }

  let remaining = discountTotal;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === groups.length - 1) {
      g.discount = Math.min(remaining, g.subtotal);
      remaining -= g.discount;
      break;
    }
    const share = Math.floor((discountTotal * g.subtotal) / totalSubtotal);
    g.discount = Math.min(share, g.subtotal);
    remaining -= g.discount;
  }
}

// Distribute platform-level discount to shop groups based on net base = subtotal - shopDiscount.
function distributePlatformDiscount(groups, discountTotal) {
  const bases = groups.map((g) => Math.max(0, Number(g.subtotal || 0) - Number(g.shopDiscount || 0)));
  const totalBase = bases.reduce((s, b) => s + b, 0);
  if (discountTotal <= 0 || totalBase <= 0) {
    for (const g of groups) g.discount = 0;
    return;
  }

  let remaining = discountTotal;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const base = bases[i];
    if (i === groups.length - 1) {
      g.discount = Math.min(remaining, base);
      remaining -= g.discount;
      break;
    }
    const share = Math.floor((discountTotal * base) / totalBase);
    g.discount = Math.min(share, base);
    remaining -= g.discount;
  }
}

async function resolveShippingAddressForCheckout(userId, body) {
  if (body.addressId) {
    const addr = await prisma.address.findFirst({
      where: { id: body.addressId, userId },
    });
    if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");

    return {
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2,
      ward: addr.ward,
      district: addr.district,
      city: addr.city,
      province: addr.province,
      country: addr.country,
      postalCode: addr.postalCode,
    };
  }

  if (body.shipping) return body.shipping;

  throw httpError(400, "Thiếu địa chỉ giao hàng (addressId hoặc shipping)");
}

async function resolveLineItemsForCheckout(userId, body) {
  if (body.items && body.items.length > 0) return body.items;

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  const items = (cart?.items || []).map((it) => ({ skuId: it.skuId, qty: it.qty }));
  if (items.length === 0) throw httpError(400, "Giỏ hàng trống");

  return items;
}

async function buildCheckoutGroups(userId, body, address) {
  const items = await resolveLineItemsForCheckout(userId, body);
  const skuIds = Array.from(new Set(items.map((i) => i.skuId)));

  const skus = await prisma.sKU.findMany({
    where: { id: { in: skuIds } },
    include: {
      product: {
        include: {
          shop: true,
        },
      },
    },
  });

  const skuMap = new Map(skus.map((s) => [s.id, s]));
  const groupsMap = new Map();

  for (const it of items) {
    const sku = skuMap.get(it.skuId);
    if (!sku) throw httpError(404, `SKU ${it.skuId} không tồn tại`);
    if (sku.status !== "ACTIVE") throw httpError(400, "SKU không còn bán");

    const product = sku.product;
    if (!product || product.status !== "ACTIVE") throw httpError(400, "Sản phẩm không còn bán");

    if (sku.stock < it.qty) throw httpError(409, `Hết hàng: ${product.name}`);

    const shop = product.shop;
    if (!shop || shop.status !== "ACTIVE") throw httpError(400, "Shop tạm ngưng hoạt động");

    const unitPrice = calcItemPrice(sku, product);
    const name = sku.name ? `${product.name} - ${sku.name}` : product.name;

    const lineTotal = unitPrice * it.qty;
    const weightGram = sku.weightGram ?? 500;

    // Snapshot cost price for profit calculation.
    const costPrice = sku.costPrice ?? null;

    const itemRow = {
      skuId: sku.id,
      productId: product.id,
      shopId: shop.id,
      qty: it.qty,
      unitPrice,
      costPrice,
      name,
      weightGram,
      lineTotal,
    };

    if (!groupsMap.has(shop.id)) {
      groupsMap.set(shop.id, {
        shop: { id: shop.id, name: shop.name, slug: shop.slug, ownerId: shop.ownerId },
        shopId: shop.id,
        subtotal: 0,
        items: [],
        shipping: null,
        shippingOptions: [],
        shippingError: null,
        shopVoucher: null,
        shopDiscount: 0,
        discount: 0,
        total: 0,
      });
    }

    const g = groupsMap.get(shop.id);
    g.items.push(itemRow);
    g.subtotal += lineTotal;
  }

  const groups = Array.from(groupsMap.values());

  // Quote shipping per group
  for (const g of groups) {
    const quote = await quoteShippingOptionsForGroup({
      shopId: g.shopId,
      subtotal: g.subtotal,
      items: g.items,
      address,
    });
    g.shippingOptions = quote.options;
    g.shipping = quote.selected;
    g.shippingError = quote.error;
  }

  // Apply shop vouchers (per shop)
  const shopVoucherMap = new Map((body.shopVouchers || []).map((x) => [Number(x.shopId), x.code]));
  for (const g of groups) {
    const code = shopVoucherMap.get(Number(g.shopId));
    if (!code) {
      g.shopVoucher = null;
      g.shopDiscount = 0;
      continue;
    }
    const r = await validateShopVoucherByCode({ code, shopId: g.shopId, subtotal: g.subtotal, userId });
    if (!r.ok) throw httpError(400, r.reason || "Voucher shop không hợp lệ");
    g.shopVoucher = r.voucher;
    g.shopDiscount = r.discount;
  }

  // Platform voucher applied at checkout level (after shop-voucher discounts), then distributed to groups
  let voucher = null;
  let platformDiscountTotal = 0;
  const platformBaseSubtotal = groups.reduce((s, g) => s + Math.max(0, g.subtotal - (g.shopDiscount || 0)), 0);
  if (body.voucherCode) {
    const v = await resolveVoucher(body.voucherCode, platformBaseSubtotal, userId);
    if (!v.ok) throw httpError(400, v.message);
    voucher = v.voucher;
    platformDiscountTotal = v.discount;
  }

  distributePlatformDiscount(groups, platformDiscountTotal);

  // Totals
  for (const g of groups) {
    const shippingFee = g.shipping ? g.shipping.fee : 0;
    g.total = g.subtotal + shippingFee - (g.shopDiscount || 0) - (g.discount || 0);
  }

  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = groups.reduce((s, g) => s + (g.shipping ? g.shipping.fee : 0), 0);
  const shopDiscountTotal = groups.reduce((s, g) => s + (g.shopDiscount || 0), 0);
  const discountTotal = shopDiscountTotal + platformDiscountTotal;
  const total = subtotal + shippingTotal - discountTotal;

  return {
    address,
    voucher,
    platformDiscountTotal,
    shopDiscountTotal,
    discountTotal,
    groups,
    totals: { subtotal, shippingTotal, platformDiscountTotal, shopDiscountTotal, discountTotal, total },
  };
}

// Recompute voucher discounts & totals for an existing draft (keep shipping selections as-is).
// You can optionally override platform voucher code and/or shop voucher selection.
async function recomputeDraftVouchers(tx, draft, userId, { platformVoucherCode, shopVoucherByShopId } = {}) {
  const groups = await tx.checkoutDraftGroup.findMany({
    where: { draftId: draft.id },
    include: { shopVoucher: true },
    orderBy: { id: "asc" },
  });

  const overrideShopMap = shopVoucherByShopId instanceof Map ? shopVoucherByShopId : new Map(Object.entries(shopVoucherByShopId || {}).map(([k, v]) => [Number(k), v]));

  const computed = [];
  for (const g of groups) {
    const hasOverride = overrideShopMap.has(Number(g.shopId));
    let code = hasOverride ? overrideShopMap.get(Number(g.shopId)) : g.shopVoucher?.code;
    if (code === "") code = null;
    if (code == null) {
      computed.push({
        groupId: g.id,
        shopId: g.shopId,
        subtotal: g.subtotal,
        shippingFee: g.shippingFee,
        shopVoucherId: null,
        shopDiscount: 0,
      });
      continue;
    }

    const r = await validateShopVoucherByCode({ code, shopId: g.shopId, subtotal: g.subtotal, userId, tx });
    if (!r.ok) {
      if (hasOverride) throw httpError(400, r.reason || "Voucher shop không hợp lệ");
      // If previously selected voucher becomes invalid, auto-clear for safety.
      computed.push({
        groupId: g.id,
        shopId: g.shopId,
        subtotal: g.subtotal,
        shippingFee: g.shippingFee,
        shopVoucherId: null,
        shopDiscount: 0,
      });
      continue;
    }

    computed.push({
      groupId: g.id,
      shopId: g.shopId,
      subtotal: g.subtotal,
      shippingFee: g.shippingFee,
      shopVoucherId: r.voucher.id,
      shopDiscount: r.discount,
    });
  }

  const platformBaseSubtotal = computed.reduce((s, g) => s + Math.max(0, g.subtotal - g.shopDiscount), 0);
  const platformHasOverride = platformVoucherCode !== undefined;
  let platformCode = platformHasOverride ? platformVoucherCode : draft.voucherCode;
  if (platformCode === "") platformCode = null;

  let platformVoucherId = null;
  let platformDiscountTotal = 0;
  if (platformCode) {
    const r = await validatePlatformVoucherByCode({ code: platformCode, subtotal: platformBaseSubtotal, userId, tx });
    if (!r.ok) {
      if (platformHasOverride) throw httpError(400, r.reason || "Voucher không hợp lệ");
      platformCode = null;
      platformVoucherId = null;
      platformDiscountTotal = 0;
    } else {
      platformVoucherId = r.voucher.id;
      platformDiscountTotal = r.discount;
    }
  }

  // Distribute platform discount across shop groups
  const calcGroups = computed.map((g) => ({
    id: g.groupId,
    shopId: g.shopId,
    subtotal: g.subtotal,
    shippingFee: g.shippingFee,
    shopDiscount: g.shopDiscount,
    discount: 0,
  }));
  distributePlatformDiscount(calcGroups, platformDiscountTotal);

  const subtotal = calcGroups.reduce((s, g) => s + g.subtotal, 0);
  const shippingTotal = calcGroups.reduce((s, g) => s + g.shippingFee, 0);
  const shopDiscountTotal = computed.reduce((s, g) => s + g.shopDiscount, 0);
  const discountTotal = shopDiscountTotal + platformDiscountTotal;
  const total = subtotal + shippingTotal - discountTotal;

  // Persist
  for (let i = 0; i < calcGroups.length; i++) {
    const cg = calcGroups[i];
    const meta = computed[i];
    await tx.checkoutDraftGroup.update({
      where: { id: meta.groupId },
      data: {
        shopVoucherId: meta.shopVoucherId,
        shopDiscount: meta.shopDiscount,
        discount: cg.discount,
        total: cg.subtotal + cg.shippingFee - meta.shopDiscount - cg.discount,
      },
    });
  }

  const updatedDraft = await tx.checkoutDraft.update({
    where: { id: draft.id },
    data: {
      voucherId: platformVoucherId,
      voucherCode: platformCode || null,
      discountTotal,
      shippingTotal,
      total,
    },
  });

  return { updatedDraft, platformDiscountTotal, shopDiscountTotal, discountTotal, total };
}

// Quote shipping options (no persistence)
router.post(
  "/shipping/options",
  asyncHandler(async (req, res) => {
    const body = checkoutDraftSchema.parse(req.body);
    const userId = req.user.sub;

    const address = await resolveShippingAddressForCheckout(userId, body);
    const result = await buildCheckoutGroups(userId, body, address);

    res.json({ success: true, data: result });
  })
);

// Create checkout draft
router.post(
  "/checkout/draft",
  asyncHandler(async (req, res) => {
    const body = checkoutDraftSchema.parse(req.body);
    const userId = req.user.sub;

    const address = await resolveShippingAddressForCheckout(userId, body);
    const result = await buildCheckoutGroups(userId, body, address);

    const draftCode = genDraftCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const shipSnapshot = buildShipSnapshotFromAddress(address);

    const draft = await prisma.$transaction(async (tx) => {
      const createdDraft = await tx.checkoutDraft.create({
        data: {
          code: draftCode,
          userId,
          status: "DRAFT",
          currency: "VND",
          subtotal: result.totals.subtotal,
          shippingTotal: result.totals.shippingTotal,
          discountTotal: result.totals.discountTotal,
          total: result.totals.total,
          note: body.note || null,
          voucherId: result.voucher ? result.voucher.id : null,
          voucherCode: body.voucherCode || null,
          ...shipSnapshot,
          expiresAt,
        },
      });

      for (const g of result.groups) {
        const shippingFee = g.shipping ? g.shipping.fee : 0;

        const groupRow = await tx.checkoutDraftGroup.create({
          data: {
            draftId: createdDraft.id,
            shopId: g.shopId,
            subtotal: g.subtotal,
            shippingFee,
            discount: g.discount || 0,
            shopDiscount: g.shopDiscount || 0,
            shopVoucherId: g.shopVoucher ? g.shopVoucher.id : null,
            total: g.subtotal + shippingFee - (g.shopDiscount || 0) - (g.discount || 0),
            shippingConfigId: g.shipping ? g.shipping.configId : null,
            shippingCarrier: g.shipping ? g.shipping.carrier : null,
            shippingServiceName: g.shipping ? g.shipping.serviceName : null,
            shippingOptionCode: g.shipping ? g.shipping.optionId : null,
            etaMinDays: g.shipping ? g.shipping.eta.minDays : null,
            etaMaxDays: g.shipping ? g.shipping.eta.maxDays : null,
            errorCode: g.shippingError ? g.shippingError.code : null,
            errorMessage: g.shippingError ? g.shippingError.message : null,
          },
        });

        for (const it of g.items) {
          await tx.checkoutDraftItem.create({
            data: {
              draftId: createdDraft.id,
              groupId: groupRow.id,
              shopId: g.shopId,
              skuId: it.skuId,
              productId: it.productId,
              name: it.name,
              unitPrice: it.unitPrice,
              costPrice: it.costPrice ?? null,
              qty: it.qty,
              weightGram: it.weightGram,
              lineTotal: it.lineTotal,
            },
          });
        }
      }

      return createdDraft;
    });

    res.status(201).json({
      success: true,
      data: {
        draft: { ...draft, address, expiresAt },
        ...result,
        draftCode,
      },
    });
  })
);

// Get checkout draft (re-quote shipping options for UI)
router.get(
  "/checkout/draft/:code",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;

    const draft = await prisma.checkoutDraft.findFirst({
      where: { code, userId },
      include: {
        voucher: true,
        groups: {
          include: {
            shop: true,
            shopVoucher: true,
            items: true,
          },
        },
      },
    });
    if (!draft) throw httpError(404, "Không tìm thấy draft");

    const address = draftToAddress(draft);

    const groups = [];
    for (const g of draft.groups) {
      const items = g.items.map((it) => ({
        skuId: it.skuId,
        productId: it.productId,
        qty: it.qty,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice ?? null,
        name: it.name,
        weightGram: it.weightGram,
        lineTotal: it.lineTotal,
      }));

      const quote = await quoteShippingOptionsForGroup({
        shopId: g.shopId,
        subtotal: g.subtotal,
        items,
        address,
      });

      groups.push({
        shop: { id: g.shop.id, name: g.shop.name, slug: g.shop.slug },
        shopId: g.shopId,
        subtotal: g.subtotal,
        discount: g.discount,
        shopDiscount: g.shopDiscount,
        shopVoucher: g.shopVoucher ? { id: g.shopVoucher.id, code: g.shopVoucher.code, type: g.shopVoucher.type, value: g.shopVoucher.value } : null,
        total: g.total,
        items,
        shipping: g.shippingOptionCode
          ? quote.options.find((o) => o.optionId === g.shippingOptionCode) || null
          : null,
        shippingOptions: quote.options,
        shippingError: quote.error,
        selectedOptionCode: g.shippingOptionCode || null,
      });
    }

    res.json({
      success: true,
      data: {
        draft,
        address,
        groups,
        totals: {
          subtotal: draft.subtotal,
          shippingTotal: draft.shippingTotal,
          discountTotal: draft.discountTotal,
          total: draft.total,
        },
      },
    });
  })
);

// Update selected shipping option for a shop within a draft
router.patch(
  "/checkout/draft/:code/shipping",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;
    const body = draftShippingSchema.parse(req.body);

    const draft = await prisma.checkoutDraft.findFirst({
      where: { code, userId },
      include: {
        groups: { include: { items: true } },
      },
    });
    if (!draft) throw httpError(404, "Không tìm thấy draft");
    if (draft.status !== "DRAFT") throw httpError(400, "Draft không còn hợp lệ");
    if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
      throw httpError(400, "Draft đã hết hạn");
    }

    const group = draft.groups.find((g) => g.shopId === body.shopId);
    if (!group) throw httpError(404, "Không tìm thấy nhóm shop trong draft");

    const address = draftToAddress(draft);

    // fetch config by shop + code
    const cfg = await prisma.shippingConfig.findFirst({
      where: { shopId: body.shopId, code: body.optionCode, isActive: true },
    });
    if (!cfg) throw httpError(404, "Không tìm thấy phương thức vận chuyển");

    // validate zones/constraints
    const zones = parseZonesJson(cfg.zonesJson);
    const zoneOk = zones.length === 0 || zones.some((z) => zoneMatches(z, address));
    if (!zoneOk) throw httpError(400, "Phương thức vận chuyển không áp dụng cho địa chỉ này");

    const groupItems = group.items.map((it) => ({
      qty: it.qty,
      weightGram: it.weightGram,
    }));
    const metrics = calcGroupMetrics(groupItems);
    if (cfg.maxWeightGram != null && metrics.totalWeightGram > cfg.maxWeightGram) {
      throw httpError(400, "Đơn vượt quá giới hạn khối lượng của phương thức vận chuyển");
    }

    let fee =
      (cfg.baseFee || 0) +
      (cfg.feePerItem || 0) * metrics.itemCount +
      (cfg.feePerKg || 0) * metrics.weightKg;

    if (cfg.freeShippingOver != null && group.subtotal >= cfg.freeShippingOver) fee = 0;
    fee = Math.max(0, fee);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedGroup = await tx.checkoutDraftGroup.update({
        where: { id: group.id },
        data: {
          shippingConfigId: cfg.id,
          shippingCarrier: cfg.carrier,
          shippingServiceName: cfg.serviceName,
          shippingOptionCode: cfg.code,
          etaMinDays: cfg.minDays,
          etaMaxDays: cfg.maxDays,
          shippingFee: fee,
          total: group.subtotal + fee - (group.shopDiscount || 0) - group.discount,
          errorCode: null,
          errorMessage: null,
        },
      });

      const draftGroups = await tx.checkoutDraftGroup.findMany({
        where: { draftId: draft.id },
      });

      const shippingTotal = draftGroups.reduce((s, g) => s + g.shippingFee, 0);
      const total = draft.subtotal + shippingTotal - draft.discountTotal;

      const updatedDraft = await tx.checkoutDraft.update({
        where: { id: draft.id },
        data: { shippingTotal, total },
      });

      return { updatedDraft, updatedGroup };
    });

    res.json({ success: true, data: updated });
  })
);

// --- Vouchers (available/apply) for the new checkout draft flow ---
const draftPlatformVoucherSchema = z.object({
  voucherCode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().min(2).max(50).nullable().optional()
  ),
});

const draftShopVoucherSchema = z.object({
  shopId: z.number().int().positive(),
  voucherCode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().min(2).max(50).nullable().optional()
  ),
});

router.get(
  "/checkout/draft/:code/vouchers",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;

    const draft = await prisma.checkoutDraft.findFirst({
      where: { code, userId },
      include: {
        voucher: true,
        groups: { include: { shop: true, shopVoucher: true } },
      },
    });
    if (!draft) throw httpError(404, "Không tìm thấy draft");

    const now = new Date();
    const platformBaseSubtotal = draft.groups.reduce(
      (s, g) => s + Math.max(0, Number(g.subtotal || 0) - Number(g.shopDiscount || 0)),
      0
    );

    const [platformSpendMonth, platformSpendYear] = await Promise.all([
      getUserSpendPlatform(userId, { since: startOfMonth(now) }),
      getUserSpendPlatform(userId, { since: startOfYear(now) }),
    ]);

    const evalVoucher = (v, subtotal, spendMonth, spendYear) => {
      if (!isVoucherWindowActive(v, now)) {
        return { eligible: false, reason: "Không còn hiệu lực", estimatedDiscount: 0 };
      }
      if (v.usageLimit != null && v.usedCount >= v.usageLimit) {
        return { eligible: false, reason: "Đã hết lượt", estimatedDiscount: 0 };
      }
      if (subtotal < Number(v.minSubtotal || 0)) {
        return { eligible: false, reason: "Chưa đạt giá trị tối thiểu", estimatedDiscount: 0 };
      }
      if (Number(v.minBuyerSpendMonth || 0) > 0 && spendMonth < Number(v.minBuyerSpendMonth || 0)) {
        return { eligible: false, reason: "Chưa đạt điều kiện khách hàng", estimatedDiscount: 0 };
      }
      if (Number(v.minBuyerSpendYear || 0) > 0 && spendYear < Number(v.minBuyerSpendYear || 0)) {
        return { eligible: false, reason: "Chưa đạt điều kiện khách hàng", estimatedDiscount: 0 };
      }
      return { eligible: true, reason: null, estimatedDiscount: calcVoucherDiscount(v, subtotal) };
    };

    const platformVouchers = await prisma.voucher.findMany({ orderBy: { id: "desc" }, take: 200 });
    const platform = platformVouchers.map((v) => ({
      id: v.id,
      code: v.code,
      type: v.type,
      value: v.value,
      maxDiscount: v.maxDiscount,
      minSubtotal: v.minSubtotal,
      startAt: v.startAt,
      endAt: v.endAt,
      usageLimit: v.usageLimit,
      usedCount: v.usedCount,
      isActive: v.isActive,
      minBuyerSpendMonth: v.minBuyerSpendMonth,
      minBuyerSpendYear: v.minBuyerSpendYear,
      ...evalVoucher(v, platformBaseSubtotal, platformSpendMonth, platformSpendYear),
    }));

    const shops = [];
    for (const g of draft.groups) {
      const [shopSpendMonth, shopSpendYear] = await Promise.all([
        getUserSpendShop(userId, g.shopId, { since: startOfMonth(now) }),
        getUserSpendShop(userId, g.shopId, { since: startOfYear(now) }),
      ]);

      const shopVouchers = await prisma.shopVoucher.findMany({
        where: { shopId: g.shopId },
        orderBy: { id: "desc" },
        take: 200,
      });

      shops.push({
        shopId: g.shopId,
        shop: { id: g.shop.id, name: g.shop.name, slug: g.shop.slug },
        baseSubtotal: g.subtotal,
        selectedCode: g.shopVoucher?.code || null,
        vouchers: shopVouchers.map((v) => ({
          id: v.id,
          code: v.code,
          type: v.type,
          value: v.value,
          maxDiscount: v.maxDiscount,
          minSubtotal: v.minSubtotal,
          startAt: v.startAt,
          endAt: v.endAt,
          usageLimit: v.usageLimit,
          usedCount: v.usedCount,
          isActive: v.isActive,
          minBuyerSpendMonth: v.minBuyerSpendMonth,
          minBuyerSpendYear: v.minBuyerSpendYear,
          ...evalVoucher(v, g.subtotal, shopSpendMonth, shopSpendYear),
        })),
      });
    }

    res.json({
      success: true,
      data: {
        platform: {
          baseSubtotal: platformBaseSubtotal,
          selectedCode: draft.voucherCode || null,
          vouchers: platform,
        },
        shops,
      },
    });
  })
);

router.patch(
  "/checkout/draft/:code/voucher",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;
    const body = draftPlatformVoucherSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const draft = await tx.checkoutDraft.findFirst({ where: { code, userId } });
      if (!draft) throw httpError(404, "Không tìm thấy draft");
      if (draft.status !== "DRAFT") throw httpError(400, "Draft không còn hợp lệ");
      if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
        throw httpError(400, "Draft đã hết hạn");
      }

      return recomputeDraftVouchers(tx, draft, userId, { platformVoucherCode: body.voucherCode ?? null });
    });

    res.json({ success: true, data: updated });
  })
);

router.patch(
  "/checkout/draft/:code/shop-voucher",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;
    const body = draftShopVoucherSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const draft = await tx.checkoutDraft.findFirst({ where: { code, userId }, include: { groups: true } });
      if (!draft) throw httpError(404, "Không tìm thấy draft");
      if (draft.status !== "DRAFT") throw httpError(400, "Draft không còn hợp lệ");
      if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
        throw httpError(400, "Draft đã hết hạn");
      }

      const hasGroup = (draft.groups || []).some((g) => Number(g.shopId) === Number(body.shopId));
      if (!hasGroup) throw httpError(404, "Không tìm thấy nhóm shop trong draft");

      return recomputeDraftVouchers(tx, draft, userId, { shopVoucherByShopId: { [body.shopId]: body.voucherCode ?? null } });
    });

    res.json({ success: true, data: updated });
  })
);

const draftNoteSchema = z.object({
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().max(500).nullable().optional()
  ),
});

router.patch(
  "/checkout/draft/:code/note",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const code = req.params.code;
    const body = draftNoteSchema.parse(req.body);

    const draft = await prisma.checkoutDraft.findFirst({ where: { code, userId } });
    if (!draft) throw httpError(404, "Không tìm thấy draft");
    if (draft.status !== "DRAFT") throw httpError(400, "Draft không còn hợp lệ");
    if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
      throw httpError(400, "Draft đã hết hạn");
    }

    const updated = await prisma.checkoutDraft.update({
      where: { id: draft.id },
      data: { note: body.note ?? null },
    });

    res.json({ success: true, data: updated });
  })
);

// Commit draft -> create orders (idempotent)
router.post(
  "/checkout/commit",
  withIdempotency(
    "CHECKOUT_COMMIT",
    async (req) => {
      const userId = req.user.sub;
      const body = checkoutCommitSchema.parse(req.body);

      const draft = await prisma.checkoutDraft.findFirst({
        where: { code: body.draftCode, userId },
        include: {
          groups: { include: { items: true, shop: true } },
          voucher: true,
        },
      });

      if (!draft) throw httpError(404, "Không tìm thấy draft");
      if (draft.status !== "DRAFT") throw httpError(400, "Draft không còn hợp lệ");
      if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
        throw httpError(400, "Draft đã hết hạn");
      }

      // Ensure all groups have a valid shipping selection and no error
      for (const g of draft.groups) {
        if (g.errorCode) throw httpError(400, g.errorMessage || "Draft có nhóm shop không hợp lệ");
        if (!g.shippingConfigId || !g.shippingOptionCode) {
          throw httpError(400, "Vui lòng chọn phương thức vận chuyển cho tất cả shop");
        }
      }

      // Re-validate voucher usage (atomic update inside transaction)
      const voucherId = draft.voucherId || null;

      const created = await prisma.$transaction(async (tx) => {
        // Platform voucher (re-validate with loyalty rules + base subtotal)
        if (voucherId) {
          const platformBaseSubtotal = draft.groups.reduce(
            (s, g) => s + Math.max(0, Number(g.subtotal || 0) - Number(g.shopDiscount || 0)),
            0
          );

          const r = await validatePlatformVoucherById({ id: voucherId, subtotal: platformBaseSubtotal, userId, tx });
          if (!r.ok) throw httpError(400, r.reason || "Voucher không hợp lệ");
          const v = r.voucher;

          if (v.usageLimit != null) {
            const updatedCount = await tx.voucher.updateMany({
              where: { id: voucherId, usedCount: { lt: v.usageLimit } },
              data: { usedCount: { increment: 1 } },
            });
            if (updatedCount.count === 0) throw httpError(409, "Voucher đã hết lượt sử dụng");
          } else {
            await tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { increment: 1 } } });
          }
        }

        // Shop vouchers (each shop group may have one)
        for (const g of draft.groups) {
          if (!g.shopVoucherId) continue;
          const r = await validateShopVoucherById({ id: g.shopVoucherId, shopId: g.shopId, subtotal: g.subtotal, userId, tx });
          if (!r.ok) throw httpError(400, r.reason || "Voucher shop không hợp lệ");
          const sv = r.voucher;

          if (sv.usageLimit != null) {
            const updatedCount = await tx.shopVoucher.updateMany({
              where: { id: sv.id, usedCount: { lt: sv.usageLimit } },
              data: { usedCount: { increment: 1 } },
            });
            if (updatedCount.count === 0) throw httpError(409, "Voucher shop đã hết lượt sử dụng");
          } else {
            await tx.shopVoucher.update({ where: { id: sv.id }, data: { usedCount: { increment: 1 } } });
          }
        }

        const groupCode = genGroupCode();
        const createdOrders = [];

        // Create orders per shop
        for (const g of draft.groups) {
          const orderCode = genOrderCode();
          const order = await tx.order.create({
            data: {
              code: orderCode,
              groupCode,
              userId,
              shopId: g.shopId,
              status: body.paymentMethod === "BANK_TRANSFER" ? "PENDING_PAYMENT" : "PLACED",
              currency: draft.currency,
              subtotal: g.subtotal,
              shippingFee: g.shippingFee,
              discount: (g.discount || 0) + (g.shopDiscount || 0),
              total: g.total,
              note: draft.note,
              voucherId: voucherId,
              shopVoucherId: g.shopVoucherId || null,
              shippingCarrier: g.shippingCarrier,
              shippingServiceName: g.shippingServiceName,
              shippingOptionCode: g.shippingOptionCode,
              shippingEtaMinDays: g.etaMinDays,
              shippingEtaMaxDays: g.etaMaxDays,
              shipFullName: draft.shipFullName,
              shipPhone: draft.shipPhone,
              shipLine1: draft.shipLine1,
              shipLine2: draft.shipLine2,
              shipWard: draft.shipWard,
              shipDistrict: draft.shipDistrict,
              shipCity: draft.shipCity,
              shipProvince: draft.shipProvince,
              shipCountry: draft.shipCountry,
              shipPostalCode: draft.shipPostalCode,
            },
          });

          // Items + stock deduction
          for (const it of g.items) {
            await tx.orderItem.create({
              data: {
                orderId: order.id,
                productId: it.productId,
                skuId: it.skuId,
                name: it.name,
                unitPrice: it.unitPrice,
                costPrice: it.costPrice ?? null,
                qty: it.qty,
                lineTotal: it.lineTotal,
              },
            });

            const updatedSku = await tx.sKU.updateMany({
              where: { id: it.skuId, stock: { gte: it.qty }, status: "ACTIVE" },
              data: { stock: { decrement: it.qty } },
            });
            if (updatedSku.count === 0) throw httpError(409, "Hết hàng (vui lòng thử lại)");

            await tx.product.update({
              where: { id: it.productId },
              data: { soldCount: { increment: it.qty } },
            });
          }

          await createPaymentForOrder(order.id, body.paymentMethod, order.total, tx);
          await tx.chatThread.create({ data: { orderId: order.id } });

          // Notifications (within tx)
          // NOTE: Notification model requires `title` (not `message`).
          await notify(
            userId,
            {
              type: "ORDER_PLACED",
              title: "Đặt hàng thành công",
              body: `Đặt hàng thành công: ${order.code}`,
              data: { orderCode: order.code },
            },
            tx
          );

          await notify(
            g.shop.ownerId,
            {
              type: "NEW_ORDER",
              title: "Bạn có đơn hàng mới",
              body: `Bạn có đơn hàng mới: ${order.code}`,
              data: { orderCode: order.code },
            },
            tx
          );

          createdOrders.push(order);
        }

        // Clear only purchased items from cart
        const skuIds = draft.groups.flatMap((gr) => gr.items.map((it) => it.skuId));
        await tx.cartItem.deleteMany({
          where: { cart: { userId }, skuId: { in: skuIds } },
        });

        await tx.checkoutDraft.update({
          where: { id: draft.id },
          data: { status: "COMMITTED", committedAt: new Date() },
        });

        return { groupCode, orders: createdOrders };
      });

      return { status: 201, body: { success: true, data: created } };
    },
    { requireKey: true, ttlSeconds: 60 * 60 * 24 }
  )
);


router.post(
  "/checkout",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const body = checkoutSchema.parse(req.body);

    // Resolve shipping address
    let ship = null;
    if (body.addressId) {
      const addr = await prisma.address.findFirst({ where: { id: body.addressId, userId } });
      if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");
      ship = {
        fullName: addr.fullName,
        phone: addr.phone,
        line1: addr.line1,
        line2: addr.line2,
        ward: addr.ward,
        district: addr.district,
        city: addr.city,
        province: addr.province,
        country: addr.country,
        postalCode: addr.postalCode,
      };
    } else if (body.shipping) {
      ship = body.shipping;
    }

    if (!ship) throw httpError(400, "Thiếu địa chỉ giao hàng");

    // Items: from payload or cart
    let lineItems = body.items;
    if (!lineItems) {
      const cart = await getOrCreateCart(userId);
      const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
      if (cartItems.length === 0) throw httpError(400, "Giỏ hàng trống");
      lineItems = cartItems.map((it) => ({ skuId: it.skuId, qty: it.qty }));
    }

    // Load SKUs with product & shop
    const skuIds = Array.from(new Set(lineItems.map((x) => x.skuId)));
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      include: { product: { include: { shop: true } } },
    });

    if (skus.length !== skuIds.length) throw httpError(400, "Có sản phẩm không tồn tại");

    // Group by shop
    const skuMap = new Map(skus.map((s) => [s.id, s]));
    const groups = new Map(); // shopId -> items
    for (const li of lineItems) {
      const sku = skuMap.get(li.skuId);
      if (!sku) continue;
      if (sku.status !== "ACTIVE" || sku.product.status !== "ACTIVE") {
        throw httpError(400, `SKU ${li.skuId} không khả dụng`);
      }
      if (li.qty > sku.stock) {
        throw httpError(400, `SKU ${li.skuId} không đủ tồn kho`);
      }

      const shopId = sku.product.shopId;
      if (!groups.has(shopId)) groups.set(shopId, []);
      groups.get(shopId).push({ sku, qty: li.qty });
    }

    const createdOrders = [];
    const groupCode = genGroupCode();

    await prisma.$transaction(async (tx) => {
      // For each shop -> create order
      for (const [shopId, items] of groups.entries()) {
        const code = genOrderCode();
        const subtotal = items.reduce((sum, it) => {
          const unitPrice = calcItemPrice(it.sku, it.sku.product);
          return sum + unitPrice * it.qty;
        }, 0);

        const shippingFee = subtotal >= 500000 ? 0 : 25000;
        const { voucher, discount } = await resolveVoucher(body.voucherCode, subtotal, userId);
        const total = subtotal + shippingFee - discount;

        const order = await tx.order.create({
          data: {
            code,
            groupCode,
            userId,
            shopId,
            status: body.paymentMethod === "COD" ? "PLACED" : "PLACED",
            subtotal,
            shippingFee,
            discount,
            total,
            note: body.note || null,

            shipFullName: ship.fullName,
            shipPhone: ship.phone,
            shipLine1: ship.line1,
            shipLine2: ship.line2,
            shipWard: ship.ward,
            shipDistrict: ship.district,
            shipCity: ship.city,
            shipProvince: ship.province,
            shipCountry: ship.country || "VN",
            shipPostalCode: ship.postalCode,
            voucherId: voucher ? voucher.id : null,
          },
        });

        for (const it of items) {
          const unitPrice = calcItemPrice(it.sku, it.sku.product);
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: it.sku.productId,
              skuId: it.sku.id,
              name: it.sku.product.name + (it.sku.name ? ` - ${it.sku.name}` : ""),
              unitPrice,
              qty: it.qty,
              lineTotal: unitPrice * it.qty,
            },
          });

          // Increase sold count (demo metric)
          await tx.product.update({ where: { id: it.sku.productId }, data: { soldCount: { increment: it.qty } } });

          // Deduct stock
          await tx.sKU.update({ where: { id: it.sku.id }, data: { stock: { decrement: it.qty } } });
        }

        // Payment record
        await createPaymentForOrder(order.id, body.paymentMethod, total, tx);

        // Chat thread
        await tx.chatThread.create({ data: { orderId: order.id } });

        // Voucher used count
        if (voucher) {
          await tx.voucher.update({ where: { id: voucher.id }, data: { usedCount: { increment: 1 } } });
        }

        createdOrders.push(order);

        // Notification
        await notify(
          userId,
          {
          type: "ORDER_CONFIRM",
          title: `Xác nhận đơn ${order.code}`,
          body: `Đơn hàng đã được tạo thành công. Tổng: ${total} VND`,
          data: { orderCode: order.code },
          },
          tx
        );
      }

      // Clear server cart
      const cart = await tx.cart.findUnique({ where: { userId } });
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    });

    res.status(201).json({
      success: true,
      message: "Đã tạo đơn hàng",
      data: { groupCode, orders: createdOrders.map((o) => ({ id: o.id, code: o.code, status: o.status, total: o.total, shopId: o.shopId })) },
    });
  })
);

// --- Order groups (đặt nhiều shop trong 1 lần checkout) ---
function deriveGroupStatus(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) return "PLACED";
  const has = (s) => statuses.includes(s);
  const some = (arr) => arr.some((s) => has(s));

  // If all the same, return that
  if (statuses.every((s) => s === statuses[0])) return statuses[0];

  // Terminal / exceptional states
  if (has("DISPUTED")) return "DISPUTED";
  if (has("REFUNDED")) return "REFUNDED";
  if (has("REFUND_REQUESTED")) return "REFUND_REQUESTED";

  // Returns flow
  if (some(["RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_REJECTED", "RETURN_RECEIVED"])) {
    if (has("RETURN_REQUESTED")) return "RETURN_REQUESTED";
    if (has("RETURN_APPROVED")) return "RETURN_APPROVED";
    if (has("RETURN_REJECTED")) return "RETURN_REJECTED";
    if (has("RETURN_RECEIVED")) return "RETURN_RECEIVED";
  }

  // Cancellation flow
  if (some(["CANCEL_REQUESTED", "CANCELLED"])) {
    if (has("CANCEL_REQUESTED")) return "CANCEL_REQUESTED";
    return "CANCELLED";
  }

  // Fulfillment flow
  if (has("DELIVERED")) return "DELIVERED";
  if (has("SHIPPED")) return "SHIPPED";
  if (has("PACKING")) return "PACKING";
  if (has("CONFIRMED")) return "CONFIRMED";
  if (has("PENDING_PAYMENT")) return "PENDING_PAYMENT";
  return "PLACED";
}


router.get(
  "/order-groups",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    // Lấy nhiều hơn để gom nhóm (vì 1 group có thể có nhiều order con)
    const take = Math.min(500, page * limit * 6);

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        shop: { select: { id: true, name: true, slug: true } },
      },
    });

    const groupsMap = new Map();
    const groups = [];
    for (const o of orders) {
      const key = o.groupCode || o.code;
      let g = groupsMap.get(key);
      if (!g) {
        g = {
          groupCode: key,
          createdAt: o.createdAt,
          total: 0,
          orderCount: 0,
          shops: [],
          statuses: [],
        };
        groupsMap.set(key, g);
        groups.push(g);
      }
      g.total += o.total;
      g.orderCount += 1;
      g.statuses.push(o.status);
      if (o.shop && !g.shops.find((s) => s.id === o.shop.id)) g.shops.push(o.shop);
    }

    // Tính status nhóm
    for (const g of groups) {
      g.status = deriveGroupStatus(g.statuses);
      delete g.statuses;
    }

    // Tổng số group: scan nhẹ (demo)
    const all = await prisma.order.findMany({
      where: { userId },
      select: { code: true, groupCode: true },
    });
    const totalGroups = new Set(all.map((o) => o.groupCode || o.code)).size;

    const items = groups.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        items,
        pagination: { page, limit, total: totalGroups, totalPages: Math.ceil(totalGroups / limit) },
      },
    });
  })
);

router.get(
  "/order-groups/:groupCode",
  asyncHandler(async (req, res) => {
    const userId = req.user.sub;
    const groupCode = req.params.groupCode;

    // groupCode có thể trùng với order.code (trường hợp order cũ)
    const orders = await prisma.order.findMany({
      where: {
        userId,
        OR: [{ groupCode }, { code: groupCode }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: { include: { product: true, sku: true } },
        paymentTransactions: { orderBy: { createdAt: "desc" }, take: 1 },
        shipment: { include: { events: { orderBy: { createdAt: "desc" } } } },
        cancelRequest: true,
        returnRequest: true,
        refund: true,
        dispute: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!orders || orders.length === 0) throw httpError(404, "Không tìm thấy đơn hàng");

    const createdAt = orders[0].createdAt;
    const total = orders.reduce((sum, o) => sum + o.total, 0);
    const status = deriveGroupStatus(orders.map((o) => o.status));

    res.json({
      success: true,
      data: {
        groupCode,
        createdAt,
        total,
        status,
        orders,
      },
    });
  })
);

// --- Orders ---
router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    // Optional status filter (comma separated)
    // Example: ?status=PLACED,PACKING
    // Special value: RETURN (return/refund related statuses)
    const statusParam = String(req.query.status || "").trim();
    const statusList = statusParam
      ? statusParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const returnStatuses = [
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_REJECTED",
      "RETURN_RECEIVED",
      "REFUND_REQUESTED",
      "REFUNDED",
      "DISPUTED",
    ];

    const where = {
      userId: req.user.sub,
      ...(statusList.length
        ? {
            status: {
              in: statusList.includes("RETURN")
                ? returnStatuses
                : statusList,
            },
          }
        : {}),
    };

    const [total, itemsRaw] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          shop: { select: { id: true, name: true, slug: true } },
          shipment: true,
          returnRequest: true,
          refund: true,
          items: {
            include: {
              product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
              sku: { select: { id: true, skuCode: true, name: true } },
            },
          },
        },
      }),
    ]);

    // Attach review flags for purchased items
    const productIds = Array.from(
      new Set(
        itemsRaw
          .flatMap((o) => (o.items || []).map((it) => it.productId))
          .filter(Boolean)
      )
    );

    const reviews = productIds.length
      ? await prisma.review.findMany({
          where: { userId: req.user.sub, productId: { in: productIds } },
          select: { id: true, productId: true },
        })
      : [];
    const reviewedSet = new Set(reviews.map((r) => r.productId));

    const items = itemsRaw.map((o) => ({
      ...o,
      items: (o.items || []).map((it) => ({
        ...it,
        hasReview: reviewedSet.has(it.productId),
      })),
    }));

    res.json({
      success: true,
      data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  })
);

router.get(
  "/orders/:code",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({
      where: { code, userId: req.user.sub },
      include: {
        items: { include: { product: true, sku: true } },
        paymentTransactions: { orderBy: { createdAt: "desc" }, take: 1 },
        shipment: { include: { events: { orderBy: { createdAt: "desc" } } } },
        cancelRequest: true,
        returnRequest: true,
        refund: true,
        dispute: true,
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    // Attach review flags for purchased items
    const productIds = Array.from(new Set((order.items || []).map((it) => it.productId).filter(Boolean)));
    const reviews = productIds.length
      ? await prisma.review.findMany({ where: { userId: req.user.sub, productId: { in: productIds } }, select: { productId: true } })
      : [];
    const reviewedSet = new Set(reviews.map((r) => r.productId));

    res.json({
      success: true,
      data: {
        ...order,
        items: (order.items || []).map((it) => ({ ...it, hasReview: reviewedSet.has(it.productId) })),
      },
    });
  })
);

// Track shipment
router.get(
  "/orders/:code/tracking",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub }, include: { shipment: { include: { events: true } } } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!order.shipment) {
      return res.json({ success: true, data: { shipped: false, message: "Đơn chưa được tạo vận đơn" } });
    }
    res.json({ success: true, data: { shipped: true, shipment: order.shipment } });
  })
);

// Confirm received
router.post(
  "/orders/:code/confirm-received",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!["DELIVERED","SHIPPED","DISPUTED"].includes(order.status)) {
      throw httpError(400, "Chỉ có thể xác nhận khi đơn đang giao/đã giao");
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    res.json({ success: true, message: "Đã xác nhận nhận hàng", data: updated });
  })
);

// Cancel request
const cancelSchema = z.object({ reason: z.string().min(3).max(500) });
router.post(
  "/orders/:code/cancel-request",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = cancelSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    // Buyer cancellation policy (Shopee-like):
    // - Free cancel only when waiting seller confirmation: PENDING_PAYMENT / PLACED
    // - When preparing (CONFIRMED / PACKING): only send cancel request, seller must approve
    // - After shipped/delivered/completed or any return/refund flow: cannot cancel
    const blockedStatuses = [
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_REJECTED",
      "RETURN_RECEIVED",
      "REFUND_REQUESTED",
      "REFUNDED",
      "DISPUTED",
    ];
    if (blockedStatuses.includes(order.status)) {
      throw httpError(400, "Đơn đã vào giai đoạn không thể hủy. Vui lòng dùng Hoàn/Đổi nếu cần." );
    }

    const existing = await prisma.cancelRequest.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã gửi yêu cầu hủy" );

    // Free cancel stage
    if (["PENDING_PAYMENT", "PLACED"].includes(order.status)) {
      const created = await prisma.$transaction(async (tx) => {
        const cr = await tx.cancelRequest.create({
          data: {
            orderId: order.id,
            userId: req.user.sub,
            reason: body.reason,
            status: "APPROVED",
            originalStatus: order.status,
            resolvedById: req.user.sub,
            resolvedAt: new Date(),
          },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        // Restock inventory because order was cancelled before confirmation.
        await restockOrderItems(tx, order.id);
        return cr;
      });
      await notify(order.userId, {
        type: "ORDER_UPDATE",
        title: `Đơn ${order.code} đã được huỷ`,
        body: "Bạn đã huỷ đơn trước khi người bán xác nhận.",
        data: { orderCode: order.code },
      });
      return res.status(201).json({ success: true, message: "Đã huỷ đơn hàng", data: created });
    }

    // Preparing stage: send request to seller
    if (["CONFIRMED", "PACKING"].includes(order.status)) {
      const created = await prisma.$transaction([
        prisma.cancelRequest.create({
          data: { orderId: order.id, userId: req.user.sub, reason: body.reason, originalStatus: order.status },
        }),
        prisma.order.update({ where: { id: order.id }, data: { status: "CANCEL_REQUESTED" } }),
      ]);
      return res.status(201).json({ success: true, message: "Đã gửi yêu cầu hủy (cần người bán xác nhận)", data: created[0] });
    }

    throw httpError(400, "Trạng thái đơn không hỗ trợ huỷ" );
  })
);

// Return request
// requestType is optional to keep backward compatibility with older FE.
// Example: CHANGE_MIND, DEFECTIVE, WRONG_ITEM, NOT_AS_DESCRIBED, OTHER
const returnSchema = z.object({
  reason: z.string().min(3).max(500),
  requestType: z.string().min(2).max(50).optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
});
router.post(
  "/orders/:code/return-request",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = returnSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!['DELIVERED','DISPUTED'].includes(order.status)) {
      throw httpError(400, "Chỉ có thể yêu cầu hoàn/đổi sau khi đã giao" );
    }

    const existing = await prisma.returnRequest.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã có yêu cầu hoàn/đổi" );

    const created = await prisma.$transaction([
      prisma.returnRequest.create({
        data: {
          orderId: order.id,
          userId: req.user.sub,
          reason: body.reason,
          requestType: body.requestType || null,
          evidenceUrlsJson: body.evidenceUrls ? JSON.stringify(body.evidenceUrls) : null,
        },
      }),
      prisma.order.update({ where: { id: order.id }, data: { status: "RETURN_REQUESTED" } }),
    ]);

    res.status(201).json({ success: true, message: "Đã gửi yêu cầu hoàn/đổi", data: created[0] });
  })
);

// Refund request (standalone)
const refundReqSchema = z.object({ reason: z.string().min(3).max(500).optional() });
router.post(
  "/orders/:code/refund-request",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = refundReqSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    // Disallow refund request for cancelled orders (refund will be processed by seller approval flow).
    if (order.status === "CANCELLED") {
      throw httpError(400, "Đơn đã huỷ. Nếu đã thanh toán, hệ thống sẽ tự hoàn/CS sẽ liên hệ.");
    }
    // Shopee-like: refund-only request is allowed after delivered. Before that use Cancel/Cancel Request.
    if (!['DELIVERED','DISPUTED'].includes(order.status)) {
      throw httpError(400, "Chỉ có thể yêu cầu hoàn tiền sau khi đã giao hàng");
    }
    const rr = await prisma.returnRequest.findUnique({ where: { orderId: order.id } });
    if (rr) {
      throw httpError(409, "Đơn đã có yêu cầu hoàn/đổi. Vui lòng theo dõi trong mục Trả hàng/Hoàn tiền.");
    }
    const existing = await prisma.refund.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã có yêu cầu hoàn tiền" );

    const created = await prisma.$transaction([
      prisma.refund.create({
        data: {
          orderId: order.id,
          amount: order.total,
          reason: body.reason || null,
          status: "REQUESTED",
        },
      }),
      prisma.order.update({ where: { id: order.id }, data: { status: "REFUND_REQUESTED" } }),
    ]);

    res.status(201).json({ success: true, message: "Đã gửi yêu cầu hoàn tiền", data: created[0] });
  })
);

// Dispute
const disputeSchema = z.object({
  type: z.string().optional(),
  message: z.string().min(10).max(2000),
  mediaUrls: z.array(z.string().url()).max(6).optional(),
});

// Create dispute for an order (customer)
router.post(
  "/orders/:code/dispute",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = disputeSchema.parse(req.body);

    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");

    // Only allow disputes after delivery / within return-refund flows (Shopee-like)
    const allowedStatuses = [
      "DELIVERED",
      "COMPLETED",
      "RETURN_REQUESTED",
      "RETURN_APPROVED",
      "RETURN_REJECTED",
      "RETURN_RECEIVED",
      "REFUND_REQUESTED",
      "REFUNDED",
    ];
    if (!allowedStatuses.includes(order.status)) {
      throw httpError(400, "Chỉ có thể khiếu nại sau khi đơn đã giao hoặc trong luồng trả/hoàn.");
    }
    if (order.status === "CANCELLED") {
      throw httpError(400, "Đơn đã huỷ nên không thể tạo khiếu nại.");
    }

    // Time window: 15 days after deliveredAt (if available)
    const DISPUTE_WINDOW_DAYS = 15;
    if (order.deliveredAt) {
      const days = (Date.now() - new Date(order.deliveredAt).getTime()) / (24 * 60 * 60 * 1000);
      if (days > DISPUTE_WINDOW_DAYS) {
        throw httpError(400, `Đã quá hạn khiếu nại (${DISPUTE_WINDOW_DAYS} ngày sau khi giao).`);
      }
    }

    const existing = await prisma.dispute.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã có khiếu nại cho đơn này");

    // Tạo khiếu nại (không thay đổi Order.status).
    // Tranh chấp là 1 luồng riêng (Shopee/Tiki-like) để tránh phá trạng thái đơn hàng.
    const created = await prisma.dispute.create({
      data: {
        orderId: order.id,
        userId: req.user.sub,
        type: body.type || null,
        message: body.message,
        mediaUrlsJson: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
      },
    });

    res.status(201).json({ success: true, message: "Đã tạo khiếu nại", data: created });
  })
);

// List disputes for current customer
router.get(
  "/disputes",
  asyncHandler(async (req, res) => {
    const list = await prisma.dispute.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            total: true,
            createdAt: true,
            deliveredAt: true,
            shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        },
      },
      take: 200,
    });
    const withMedia = (list || []).map((d) => ({
      ...d,
      mediaUrls: d.mediaUrlsJson ? (() => {
        try {
          const arr = JSON.parse(d.mediaUrlsJson);
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      })() : [],
    }));
    res.json({ success: true, data: withMedia });
  })
);

// Request admin to revise a finalized dispute (only once)
const disputeRevisionSchema = z.object({
  note: z.string().trim().min(3).max(2000).optional(),
});

router.post(
  "/disputes/:id/request-revision",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = disputeRevisionSchema.parse(req.body || {});

    const dispute = await prisma.dispute.findFirst({
      where: { id, userId: req.user.sub },
      include: { order: { select: { code: true } } },
    });
    if (!dispute) throw httpError(404, "Không tìm thấy khiếu nại");

    const isFinal = dispute.status === "RESOLVED" || dispute.status === "REJECTED";
    if (!isFinal) throw httpError(400, "Chỉ có thể yêu cầu xem lại sau khi khiếu nại đã xử lý");
    if (Number(dispute.editCount || 0) >= 1) throw httpError(400, "Khiếu nại này đã được sửa 1 lần, không thể yêu cầu xem lại nữa");
    if (dispute.revisionRequestedAt) throw httpError(400, "Khiếu nại này đã có yêu cầu xem lại đang chờ xử lý");

    const updated = await prisma.dispute.update({
      where: { id },
      data: {
        revisionRequestedAt: new Date(),
        revisionRequestedById: req.user.sub,
        revisionRequestedByRole: req.user.role,
        revisionRequestNote: body.note || null,
      },
    });

    // Notify admins/CS
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "CS"] } },
      select: { id: true },
    });
    await Promise.all(
      (admins || []).map((a) =>
        notify(a.id, {
          type: "DISPUTE_REVISION_REQUEST",
          title: "Yêu cầu xem lại khiếu nại",
          body: `Đơn ${dispute.order.code} có yêu cầu xem lại từ khách hàng`,
          data: { disputeId: id, orderCode: dispute.order.code },
        })
      )
    );

    res.json({ success: true, message: "Đã gửi yêu cầu xem lại", data: updated });
  })
);
// Chat
router.get(
  "/orders/:code/chat",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({
      where: { code, userId: req.user.sub },
      include: { thread: { include: { messages: { include: { sender: { select: { id: true, username: true, role: true } } }, orderBy: { createdAt: "asc" } } } } },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    res.json({ success: true, data: order.thread?.messages || [] });
  })
);

const chatSchema = z.object({ message: z.string().min(1).max(2000) });
router.post(
  "/orders/:code/chat",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = chatSchema.parse(req.body);
    const order = await prisma.order.findFirst({
      where: { code, userId: req.user.sub },
      include: { thread: true },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    const threadId = order.thread?.id || (await prisma.chatThread.create({ data: { orderId: order.id } })).id;
    const msg = await prisma.chatMessage.create({
      data: { threadId, senderId: req.user.sub, message: body.message },
    });
    res.status(201).json({ success: true, data: msg });
  })
);

// Reorder -> trả items để FE add lại vào giỏ
router.post(
  "/orders/:code/reorder",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({
      where: { code, userId: req.user.sub },
      include: { items: true },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    res.json({ success: true, data: order.items.map((it) => ({ skuId: it.skuId, qty: it.qty })) });
  })
);

// SKU lookup (used by "Buy again" to repopulate cart with display info)
const skuLookupSchema = z.object({ skuIds: z.array(z.number().int().positive()).min(1).max(50) });
router.post(
  "/skus/lookup",
  asyncHandler(async (req, res) => {
    const body = skuLookupSchema.parse(req.body);
    const skuIds = Array.from(new Set(body.skuIds));
    const skus = await prisma.sKU.findMany({
      where: { id: { in: skuIds } },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnailUrl: true,
            status: true,
            shop: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const data = skus.map((s) => ({
      skuId: s.id,
      skuCode: s.skuCode,
      skuName: s.name,
      price: s.price != null ? s.price : s.product.price,
      stock: s.stock,
      status: s.status,
      productId: s.productId,
      name: s.product.name + (s.name ? ` - ${s.name}` : ""),
      thumbnailUrl: s.product.thumbnailUrl,
      shop: s.product.shop,
      productStatus: s.product.status,
    }));

    res.json({ success: true, data });
  })
);

// --- Reviews ---
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
});


// List my reviews (for Review Center)
router.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const where = { userId: req.user.sub };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
          shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: { shop: { select: { id: true, name: true, slug: true, logoUrl: true } } },
          },
          buyerFollowUp: true,
          sellerFollowUp: true,
        },
      }),
      prisma.review.count({ where }),
    ]);

    const withMedia = (items || []).map((r) => ({
      ...r,
      mediaUrls: r.mediaUrlsJson
        ? (() => {
            try {
              const arr = JSON.parse(r.mediaUrlsJson);
              return Array.isArray(arr) ? arr : [];
            } catch {
              return [];
            }
          })()
        : [],
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    res.json({ success: true, data: { items: withMedia, pagination: { page, limit, total, totalPages } } });
  })
);

router.post(
  "/reviews/product/:productId",
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const body = reviewSchema.parse(req.body);

    // Chỉ được review nếu đã mua sản phẩm và đơn hoàn tất
    const bought = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId: req.user.sub, status: { in: ["DELIVERED", "COMPLETED"] } },
      },
    });
    if (!bought) throw httpError(400, "Bạn cần mua và nhận hàng trước khi đánh giá" );

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw httpError(404, "Không tìm thấy sản phẩm");

    let created;
    try {
      created = await prisma.review.create({
        data: {
          userId: req.user.sub,
          productId,
          shopId: product.shopId,
          rating: body.rating,
          content: body.content || null,
          mediaUrlsJson: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
        },
      });
    } catch (e) {
      // Prisma unique constraint violation
      if (e && e.code === "P2002") {
        throw httpError(409, "Bạn đã đánh giá sản phẩm này rồi (có thể chỉnh sửa trong 7 ngày)");
      }
      throw e;
    }

    // Update rating aggregates (product/shop)
    await Promise.all([
      recalcProductRating(productId),
      recalcShopRating(product.shopId),
    ]);

    res.status(201).json({ success: true, message: "Đã gửi đánh giá", data: created });
  })
);

router.put(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = reviewSchema.partial().parse(req.body);
    const review = await prisma.review.findFirst({ where: { id, userId: req.user.sub } });
    if (!review) throw httpError(404, "Không tìm thấy đánh giá");
    if (Number(review.editCount || 0) >= 1) {
      throw httpError(400, "Bạn chỉ được chỉnh sửa đánh giá 1 lần" );
    }
    // hạn sửa: 7 ngày
    const maxEdit = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - review.createdAt.getTime() > maxEdit) {
      throw httpError(400, "Đã quá hạn sửa đánh giá" );
    }
    const updated = await prisma.review.update({
      where: { id },
      data: {
        rating: body.rating,
        content: body.content,
        mediaUrlsJson: body.mediaUrls ? JSON.stringify(body.mediaUrls) : undefined,
        editCount: { increment: 1 },
      },
    });

    await Promise.all([
      review.productId ? recalcProductRating(review.productId) : Promise.resolve(),
      review.shopId ? recalcShopRating(review.shopId) : Promise.resolve(),
    ]);

    res.json({ success: true, message: "Đã cập nhật đánh giá", data: updated });
  })
);

router.delete(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const review = await prisma.review.findFirst({ where: { id, userId: req.user.sub } });
    if (!review) throw httpError(404, "Không tìm thấy đánh giá");
    const maxEdit = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - review.createdAt.getTime() > maxEdit) {
      throw httpError(400, "Đã quá hạn xoá đánh giá" );
    }
    await prisma.review.delete({ where: { id } });

    await Promise.all([
      review.productId ? recalcProductRating(review.productId) : Promise.resolve(),
      review.shopId ? recalcShopRating(review.shopId) : Promise.resolve(),
    ]);

    res.json({ success: true, message: "Đã xoá đánh giá" });
  })
);

// Buyer follow-up after seller replied (one per review)
router.post(
  "/reviews/:id/follow-up",
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.id);
    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    const review = await prisma.review.findFirst({ where: { id: reviewId, userId: req.user.sub } });
    if (!review) throw httpError(404, "Không tìm thấy đánh giá");
    const hasSellerReply = await prisma.reviewReply.findFirst({ where: { reviewId } });
    if (!hasSellerReply) throw httpError(400, "Người bán chưa phản hồi, bạn chưa thể gửi phản hồi thêm" );
    const existing = await prisma.reviewBuyerFollowUp.findUnique({ where: { reviewId } });
    if (existing) throw httpError(409, "Bạn chỉ được phản hồi thêm 1 lần" );

    const created = await prisma.reviewBuyerFollowUp.create({
      data: { reviewId, userId: req.user.sub, content: body.content },
    });
    res.status(201).json({ success: true, message: "Đã gửi phản hồi", data: created });
  })
);

const reportSchema = z.object({ reason: z.string().min(3).max(500) });
router.post(
  "/reviews/:id/report",
  asyncHandler(async (req, res) => {
    const reviewId = Number(req.params.id);
    const body = reportSchema.parse(req.body);

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw httpError(404, "Không tìm thấy đánh giá");

    const created = await prisma.reviewReport.create({
      data: { reviewId, reporterId: req.user.sub, reason: body.reason },
    });
    res.status(201).json({ success: true, message: "Đã báo cáo đánh giá", data: created });
  })
);

// Invoice JSON
router.get(
  "/orders/:code/invoice",
  requireAuth,
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findFirst({
      where: { code, userId: req.user.sub },
      include: { items: true, shop: true, paymentTransactions: true },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    res.json({
      success: true,
      data: {
        invoiceNo: `INV-${order.code}`,
        issuedAt: order.createdAt,
        order,
      },
    });
  })
);

module.exports = router;
