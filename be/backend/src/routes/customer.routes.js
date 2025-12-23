const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { z } = require("zod");

const { createPaymentForOrder } = require("../services/payment.service");
const { notify } = require("../services/notification.service");
const { recalcProductRating, recalcShopRating } = require("../services/rating.service");

// All customer routes require login
router.use(requireAuth);

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

function calcItemPrice(sku, product) {
  const unitPrice = sku.price != null ? sku.price : product.price;
  return unitPrice;
}

async function resolveVoucher(code, subtotal) {
  if (!code) return { voucher: null, discount: 0 };
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  if (!voucher || !voucher.isActive) return { voucher: null, discount: 0, message: "Voucher không hợp lệ" };
  if (voucher.startAt && voucher.startAt.getTime() > Date.now()) return { voucher: null, discount: 0, message: "Voucher chưa hiệu lực" };
  if (voucher.endAt && voucher.endAt.getTime() < Date.now()) return { voucher: null, discount: 0, message: "Voucher đã hết hạn" };
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit)
    return { voucher: null, discount: 0, message: "Voucher đã hết lượt" };
  if (subtotal < voucher.minSubtotal) return { voucher: null, discount: 0, message: "Chưa đạt giá trị tối thiểu" };

  let discount = 0;
  if (voucher.type === "PERCENT") {
    discount = Math.floor((subtotal * voucher.value) / 100);
    if (voucher.maxDiscount != null) discount = Math.min(discount, voucher.maxDiscount);
  } else {
    discount = voucher.value;
  }

  discount = Math.min(discount, subtotal);
  return { voucher, discount };
}

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

    await prisma.$transaction(async (tx) => {
      // For each shop -> create order
      for (const [shopId, items] of groups.entries()) {
        const code = genOrderCode();
        const subtotal = items.reduce((sum, it) => {
          const unitPrice = calcItemPrice(it.sku, it.sku.product);
          return sum + unitPrice * it.qty;
        }, 0);

        const shippingFee = subtotal >= 500000 ? 0 : 25000;
        const { voucher, discount } = await resolveVoucher(body.voucherCode, subtotal);
        const total = subtotal + shippingFee - discount;

        const order = await tx.order.create({
          data: {
            code,
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
      data: { orders: createdOrders.map((o) => ({ id: o.id, code: o.code, status: o.status, total: o.total })) },
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

    const [total, items] = await Promise.all([
      prisma.order.count({ where: { userId: req.user.sub } }),
      prisma.order.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { shop: { select: { id: true, name: true, slug: true } }, shipment: true },
      }),
    ]);

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
    res.json({ success: true, data: order });
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
    if (order.status !== "DELIVERED" && order.status !== "SHIPPED") {
      throw httpError(400, "Chỉ có thể xác nhận khi đơn đang giao/đã giao");
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
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
    if (["SHIPPED", "DELIVERED", "COMPLETED"].includes(order.status)) {
      throw httpError(400, "Đơn đã giao, không thể hủy" );
    }

    const existing = await prisma.cancelRequest.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã gửi yêu cầu hủy" );

    const created = await prisma.$transaction([
      prisma.cancelRequest.create({
        data: { orderId: order.id, userId: req.user.sub, reason: body.reason },
      }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CANCEL_REQUESTED" } }),
    ]);

    res.status(201).json({ success: true, message: "Đã gửi yêu cầu hủy", data: created[0] });
  })
);

// Return request
const returnSchema = z.object({ reason: z.string().min(3).max(500), evidenceUrls: z.array(z.string().url()).optional() });
router.post(
  "/orders/:code/return-request",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = returnSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!['DELIVERED', 'COMPLETED'].includes(order.status)) {
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
const disputeSchema = z.object({ type: z.string().optional(), message: z.string().min(5).max(2000) });
router.post(
  "/orders/:code/dispute",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = disputeSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, userId: req.user.sub } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");

    const existing = await prisma.dispute.findUnique({ where: { orderId: order.id } });
    if (existing) throw httpError(409, "Đã có tranh chấp cho đơn này" );

    const created = await prisma.$transaction([
      prisma.dispute.create({
        data: { orderId: order.id, userId: req.user.sub, type: body.type, message: body.message },
      }),
      prisma.order.update({ where: { id: order.id }, data: { status: "DISPUTED" } }),
    ]);
    res.status(201).json({ success: true, message: "Đã tạo tranh chấp", data: created[0] });
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

// --- Reviews ---
const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional(),
  mediaUrls: z.array(z.string().url()).optional(),
});

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

    const created = await prisma.review.create({
      data: {
        userId: req.user.sub,
        productId,
        shopId: product.shopId,
        rating: body.rating,
        content: body.content || null,
        mediaUrlsJson: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
      },
    });

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
