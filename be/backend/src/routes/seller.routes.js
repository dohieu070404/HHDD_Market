const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { z } = require("zod");
const { slugify } = require("../utils/slugify");
const { createShipment, updateShipmentStatus } = require("../services/shipping.service");
const { refundPayment } = require("../services/payment.service");
const { notify } = require("../services/notification.service");

// Require SELLER or ADMIN
router.use(requireAuth, requireRole("SELLER", "ADMIN"));

async function getMyShop(userId) {
  return prisma.shop.findUnique({ where: { ownerId: userId } });
}

async function mustGetMyShop(userId) {
  const shop = await getMyShop(userId);
  if (!shop) throw httpError(404, "Bạn chưa có shop");
  if (shop.status === "PENDING") throw httpError(403, "Shop đang chờ duyệt");
  if (shop.status === "REJECTED") throw httpError(403, "Shop đã bị từ chối duyệt");
  if (shop.status === "SUSPENDED") throw httpError(403, "Shop đang bị tạm khoá");
  return shop;
}

// --- Shop profile ---
router.get(
  "/shop",
  asyncHandler(async (req, res) => {
    const shop = await getMyShop(req.user.sub);
    res.json({ success: true, data: shop });
  })
);

const updateShopSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
});

router.put(
  "/shop",
  asyncHandler(async (req, res) => {
    const body = updateShopSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const data = { ...body };
    if (body.name && body.name !== shop.name) {
      // đổi slug nếu đổi tên
      const baseSlug = slugify(body.name);
      let slug = baseSlug;
      const exists = await prisma.shop.findUnique({ where: { slug } });
      if (exists && exists.id !== shop.id) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
      data.slug = slug;
    }
    const updated = await prisma.shop.update({ where: { id: shop.id }, data });
    res.json({ success: true, message: "Đã cập nhật shop", data: updated });
  })
);

// --- Pickup/return addresses ---
const shopAddressSchema = z.object({
  type: z.enum(["PICKUP", "RETURN"]).default("PICKUP"),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  line1: z.string().min(1),
  line2: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

router.get(
  "/shop/addresses",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const list = await prisma.shopAddress.findMany({ where: { shopId: shop.id }, orderBy: { id: "desc" } });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/shop/addresses",
  asyncHandler(async (req, res) => {
    const body = shopAddressSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const created = await prisma.shopAddress.create({ data: { ...body, shopId: shop.id, country: body.country || "VN" } });
    res.status(201).json({ success: true, message: "Đã thêm địa chỉ", data: created });
  })
);

router.put(
  "/shop/addresses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = shopAddressSchema.partial().parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const addr = await prisma.shopAddress.findFirst({ where: { id, shopId: shop.id } });
    if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");
    const updated = await prisma.shopAddress.update({ where: { id }, data: { ...body } });
    res.json({ success: true, message: "Đã cập nhật", data: updated });
  })
);

router.delete(
  "/shop/addresses/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const addr = await prisma.shopAddress.findFirst({ where: { id, shopId: shop.id } });
    if (!addr) throw httpError(404, "Không tìm thấy địa chỉ");
    await prisma.shopAddress.delete({ where: { id } });
    res.json({ success: true, message: "Đã xoá" });
  })
);

// --- Shipping config (demo) ---
router.get(
  "/shipping-config",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const list = await prisma.shippingConfig.findMany({ where: { shopId: shop.id }, orderBy: { id: "desc" } });
    res.json({ success: true, data: list });
  })
);

const shippingConfigSchema = z.object({ carrier: z.string().min(2), isActive: z.boolean().optional() });
router.post(
  "/shipping-config",
  asyncHandler(async (req, res) => {
    const body = shippingConfigSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const created = await prisma.shippingConfig.create({ data: { shopId: shop.id, carrier: body.carrier, isActive: body.isActive ?? true } });
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  "/shipping-config/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = shippingConfigSchema.partial().parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const cfg = await prisma.shippingConfig.findFirst({ where: { id, shopId: shop.id } });
    if (!cfg) throw httpError(404, "Không tìm thấy cấu hình");
    const updated = await prisma.shippingConfig.update({ where: { id }, data: body });
    res.json({ success: true, data: updated });
  })
);

// --- Payout config (bank) ---
const payoutSchema = z.object({
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

router.get(
  "/payout",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const account = await prisma.payoutAccount.findUnique({ where: { shopId: shop.id } });
    res.json({ success: true, data: account });
  })
);

router.put(
  "/payout",
  asyncHandler(async (req, res) => {
    const body = payoutSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const account = await prisma.payoutAccount.upsert({
      where: { shopId: shop.id },
      update: body,
      create: { shopId: shop.id, ...body },
    });
    res.json({ success: true, message: "Đã cập nhật payout", data: account });
  })
);

// --- Product CRUD ---
const productSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.number().int().positive().optional(),
  price: z.number().int().nonnegative(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  thumbnailUrl: z.string().url().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN"]).optional(),
});

function genSkuCode(prefix = "SKU") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const items = await prisma.product.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, include: { skus: true } });
    res.json({ success: true, data: items });
  })
);

router.post(
  "/products",
  asyncHandler(async (req, res) => {
    const body = productSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);

    const baseSlug = slugify(body.name);
    let slug = baseSlug;
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (exists) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;

    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          shopId: shop.id,
          categoryId: body.categoryId || null,
          name: body.name,
          slug,
          description: body.description || null,
          status: body.status || "ACTIVE",
          price: body.price,
          compareAtPrice: body.compareAtPrice || null,
          thumbnailUrl: body.thumbnailUrl || null,
        },
      });

      // default SKU
      await tx.sKU.create({
        data: {
          productId: p.id,
          skuCode: genSkuCode(),
          name: "Default",
          stock: 100,
        },
      });

      return p;
    });

    res.status(201).json({ success: true, message: "Đã tạo sản phẩm", data: created });
  })
);

router.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const product = await prisma.product.findFirst({ where: { id, shopId: shop.id }, include: { images: true, skus: true } });
    if (!product) throw httpError(404, "Không tìm thấy sản phẩm");
    res.json({ success: true, data: product });
  })
);

router.put(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = productSchema.partial().parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    const data = { ...body };
    if (body.name && body.name !== p.name) {
      const baseSlug = slugify(body.name);
      let slug = baseSlug;
      const exists = await prisma.product.findUnique({ where: { slug } });
      if (exists && exists.id !== p.id) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
      data.slug = slug;
    }

    const updated = await prisma.product.update({ where: { id }, data });
    res.json({ success: true, message: "Đã cập nhật sản phẩm", data: updated });
  })
);

router.delete(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");
    // soft delete
    await prisma.product.update({ where: { id }, data: { status: "HIDDEN" } });
    res.json({ success: true, message: "Đã ẩn sản phẩm" });
  })
);

router.post(
  "/products/:id/visibility",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ status: z.enum(["ACTIVE", "HIDDEN", "DRAFT"]) }).parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");
    const updated = await prisma.product.update({ where: { id }, data: { status: body.status } });
    res.json({ success: true, message: "Đã cập nhật hiển thị", data: updated });
  })
);

// SKU management
const skuSchema = z.object({
  name: z.string().min(1).max(200),
  attributes: z.record(z.string()).optional(),
  price: z.number().int().nonnegative().optional(),
  compareAtPrice: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  status: z.enum(["ACTIVE", "HIDDEN"]).optional(),
});

router.get(
  "/products/:id/skus",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");
    const skus = await prisma.sKU.findMany({ where: { productId: p.id }, orderBy: { id: "asc" } });
    res.json({ success: true, data: skus });
  })
);

router.post(
  "/products/:id/skus",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = skuSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    const created = await prisma.sKU.create({
      data: {
        productId: p.id,
        skuCode: genSkuCode(),
        name: body.name,
        attributesJson: body.attributes ? JSON.stringify(body.attributes) : null,
        price: body.price ?? null,
        compareAtPrice: body.compareAtPrice ?? null,
        stock: body.stock ?? 0,
        status: body.status || "ACTIVE",
      },
    });
    res.status(201).json({ success: true, message: "Đã tạo SKU", data: created });
  })
);

router.put(
  "/skus/:skuId",
  asyncHandler(async (req, res) => {
    const skuId = Number(req.params.skuId);
    const body = skuSchema.partial().parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);
    const sku = await prisma.sKU.findUnique({ where: { id: skuId }, include: { product: true } });
    if (!sku || sku.product.shopId !== shop.id) throw httpError(404, "Không tìm thấy SKU");
    const updated = await prisma.sKU.update({
      where: { id: skuId },
      data: {
        name: body.name,
        attributesJson: body.attributes ? JSON.stringify(body.attributes) : undefined,
        price: body.price,
        compareAtPrice: body.compareAtPrice,
        stock: body.stock,
        status: body.status,
      },
    });
    res.json({ success: true, message: "Đã cập nhật SKU", data: updated });
  })
);

router.delete(
  "/skus/:skuId",
  asyncHandler(async (req, res) => {
    const skuId = Number(req.params.skuId);
    const shop = await mustGetMyShop(req.user.sub);
    const sku = await prisma.sKU.findUnique({ where: { id: skuId }, include: { product: true } });
    if (!sku || sku.product.shopId !== shop.id) throw httpError(404, "Không tìm thấy SKU");
    await prisma.sKU.update({ where: { id: skuId }, data: { status: "HIDDEN" } });
    res.json({ success: true, message: "Đã ẩn SKU" });
  })
);

// --- Orders for shop ---
router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.order.count({ where: { shopId: shop.id } }),
      prisma.order.findMany({
        where: { shopId: shop.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, email: true } }, shipment: true },
      }),
    ]);
    res.json({ success: true, data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  })
);

router.get(
  "/orders/:code",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({
      where: { code, shopId: shop.id },
      include: {
        items: { include: { product: true, sku: true } },
        paymentTransactions: true,
        shipment: { include: { events: { orderBy: { createdAt: "desc" } } } },
        cancelRequest: true,
        returnRequest: true,
        refund: true,
        dispute: true,
        user: { select: { id: true, username: true, email: true } },
      },
    });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    res.json({ success: true, data: order });
  })
);

// Confirm order
router.post(
  "/orders/:code/confirm",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!['PLACED', 'PENDING_PAYMENT'].includes(order.status)) throw httpError(400, "Không thể xác nhận ở trạng thái hiện tại");
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
    await notify(order.userId, { type: "ORDER_UPDATE", title: `Đơn ${order.code} đã được xác nhận`, body: "Người bán đã xác nhận đơn hàng", data: { orderCode: order.code, status: "CONFIRMED" } });
    res.json({ success: true, message: "Đã xác nhận đơn", data: updated });
  })
);

// Pack/Print (demo)
router.post(
  "/orders/:code/pack",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!['CONFIRMED'].includes(order.status)) throw httpError(400, "Không thể chuyển sang đóng gói");
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "PACKING" } });
    res.json({ success: true, message: "Đã chuyển trạng thái đóng gói", data: updated });
  })
);

// Create shipment
router.post(
  "/orders/:code/create-shipment",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { shipment: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (order.shipment) throw httpError(409, "Đơn đã có vận đơn");
    if (!['PACKING', 'CONFIRMED'].includes(order.status)) throw httpError(400, "Chưa thể tạo vận đơn");

    const shipment = await createShipment(order.id, "MOCK");
    const updatedOrder = await prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });

    await notify(order.userId, { type: "ORDER_UPDATE", title: `Đơn ${order.code} đã được giao cho vận chuyển`, body: `Mã vận đơn: ${shipment.trackingCode}`, data: { orderCode: order.code, trackingCode: shipment.trackingCode } });
    res.json({ success: true, message: "Đã tạo vận đơn", data: { order: updatedOrder, shipment } });
  })
);

// Update shipment status (demo override)
router.post(
  "/orders/:code/update-shipment",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const body = z.object({ status: z.enum(["PENDING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED"]), message: z.string().optional() }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { shipment: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (!order.shipment) throw httpError(400, "Chưa có vận đơn");

    const shipment = await updateShipmentStatus(order.shipment.id, body.status, body.message);

    // auto map to order status
    let orderStatus = order.status;
    if (body.status === "DELIVERED") orderStatus = "DELIVERED";
    if (body.status === "IN_TRANSIT") orderStatus = "SHIPPED";
    await prisma.order.update({ where: { id: order.id }, data: { status: orderStatus } });

    await notify(order.userId, { type: "SHIPMENT_UPDATE", title: `Cập nhật vận đơn ${shipment.trackingCode}`, body: body.message || body.status, data: { orderCode: order.code, status: shipment.status } });
    res.json({ success: true, message: "Đã cập nhật vận đơn", data: shipment });
  })
);

// Cancel order by seller/admin
const cancelBySellerSchema = z.object({ reason: z.string().min(3).max(500).optional() });
router.post(
  "/orders/:code/cancel",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const body = cancelBySellerSchema.parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id } });
    if (!order) throw httpError(404, "Không tìm thấy đơn hàng");
    if (['SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) throw httpError(400, "Không thể huỷ khi đã giao");
    const updated = await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    await notify(order.userId, { type: "ORDER_UPDATE", title: `Đơn ${order.code} đã bị huỷ`, body: body.reason || "Đơn bị huỷ bởi người bán", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã huỷ đơn", data: updated });
  })
);

// --- Approve cancel request ---
router.post(
  "/orders/:code/cancel-approve",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { cancelRequest: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.cancelRequest) throw httpError(404, "Không có yêu cầu huỷ");
    if (order.cancelRequest.status !== "REQUESTED") throw httpError(400, "Yêu cầu đã được xử lý");

    const refund = await refundPayment(order.id, order.total);
    await prisma.$transaction([
      prisma.cancelRequest.update({ where: { id: order.cancelRequest.id }, data: { status: "APPROVED", resolvedById: req.user.sub, resolvedAt: new Date() } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
      prisma.refund.upsert({
        where: { orderId: order.id },
        update: { status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
        create: { orderId: order.id, amount: order.total, status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
      }),
    ]);

    await notify(order.userId, { type: "CANCEL_APPROVED", title: `Yêu cầu huỷ đơn ${order.code} đã được duyệt`, body: refund.ok ? "Đã hoàn tiền (nếu có)" : "Không thể hoàn tự động, CS sẽ liên hệ", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã duyệt huỷ" });
  })
);

router.post(
  "/orders/:code/cancel-reject",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { cancelRequest: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.cancelRequest) throw httpError(404, "Không có yêu cầu huỷ");
    if (order.cancelRequest.status !== "REQUESTED") throw httpError(400, "Yêu cầu đã được xử lý");

    await prisma.$transaction([
      prisma.cancelRequest.update({ where: { id: order.cancelRequest.id }, data: { status: "REJECTED", resolvedById: req.user.sub, resolvedAt: new Date() } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } }),
    ]);

    await notify(order.userId, { type: "CANCEL_REJECTED", title: `Yêu cầu huỷ đơn ${order.code} bị từ chối`, body: "Đơn tiếp tục được xử lý", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã từ chối huỷ" });
  })
);

// --- Return requests ---
router.get(
  "/return-requests",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const list = await prisma.returnRequest.findMany({ where: { order: { shopId: shop.id } }, include: { order: true, user: { select: { id: true, username: true } } }, orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/orders/:code/return-approve",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { returnRequest: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.returnRequest) throw httpError(404, "Không có yêu cầu hoàn/đổi");
    if (order.returnRequest.status !== "REQUESTED") throw httpError(400, "Yêu cầu đã được xử lý");
    await prisma.$transaction([
      prisma.returnRequest.update({ where: { id: order.returnRequest.id }, data: { status: "APPROVED", resolvedById: req.user.sub, resolvedAt: new Date() } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "RETURN_APPROVED" } }),
    ]);
    await notify(order.userId, { type: "RETURN_APPROVED", title: `Yêu cầu hoàn/đổi ${order.code} đã được duyệt`, body: "Vui lòng gửi hàng hoàn về shop", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã duyệt hoàn/đổi" });
  })
);

router.post(
  "/orders/:code/return-reject",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const body = z.object({ reason: z.string().min(3).max(500).optional() }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { returnRequest: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.returnRequest) throw httpError(404, "Không có yêu cầu hoàn/đổi");
    if (order.returnRequest.status !== "REQUESTED") throw httpError(400, "Yêu cầu đã được xử lý");
    await prisma.$transaction([
      prisma.returnRequest.update({ where: { id: order.returnRequest.id }, data: { status: "REJECTED", resolvedById: req.user.sub, resolvedAt: new Date() } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "RETURN_REJECTED" } }),
    ]);
    await notify(order.userId, { type: "RETURN_REJECTED", title: `Yêu cầu hoàn/đổi ${order.code} bị từ chối`, body: body.reason || "Yêu cầu bị từ chối", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã từ chối hoàn/đổi" });
  })
);

// Seller receives returned goods and process refund
router.post(
  "/orders/:code/return-received",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { returnRequest: true, items: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.returnRequest) throw httpError(404, "Không có yêu cầu hoàn/đổi");
    if (!['APPROVED'].includes(order.returnRequest.status)) throw httpError(400, "Trạng thái hoàn/đổi không hợp lệ");

    const refund = await refundPayment(order.id, order.total);

    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id: order.returnRequest.id }, data: { status: "RECEIVED", resolvedById: req.user.sub, resolvedAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: "RETURN_RECEIVED" } });
      await tx.refund.upsert({
        where: { orderId: order.id },
        update: { status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
        create: { orderId: order.id, amount: order.total, status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
      });

      // Restock
      for (const it of order.items) {
        await tx.sKU.update({ where: { id: it.skuId }, data: { stock: { increment: it.qty } } });
      }
    });

    await notify(order.userId, { type: "RETURN_RECEIVED", title: `Shop đã nhận hàng hoàn - ${order.code}`, body: refund.ok ? "Đã hoàn tiền" : "Hoàn tiền thất bại, CS sẽ xử lý", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã nhận hàng hoàn & xử lý", data: { refund } });
  })
);

// --- Chat (seller side) ---
router.get(
  "/orders/:code/chat",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { thread: { include: { messages: { include: { sender: { select: { id: true, username: true, role: true } } }, orderBy: { createdAt: "asc" } } } } } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    res.json({ success: true, data: order.thread?.messages || [] });
  })
);

router.post(
  "/orders/:code/chat",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const code = req.params.code;
    const body = z.object({ message: z.string().min(1).max(2000) }).parse(req.body);
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id }, include: { thread: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    const threadId = order.thread?.id || (await prisma.chatThread.create({ data: { orderId: order.id } })).id;
    const msg = await prisma.chatMessage.create({ data: { threadId, senderId: req.user.sub, message: body.message } });
    res.status(201).json({ success: true, data: msg });
  })
);

// --- Reviews for shop ---
router.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const reviews = await prisma.review.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, username: true } }, product: { select: { id: true, name: true } }, replies: true } });
    res.json({ success: true, data: reviews });
  })
);

router.post(
  "/reviews/:id/reply",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);
    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    const review = await prisma.review.findFirst({ where: { id, shopId: shop.id } });
    if (!review) throw httpError(404, "Không tìm thấy review");
    const reply = await prisma.reviewReply.create({ data: { reviewId: id, shopId: shop.id, content: body.content } });
    res.status(201).json({ success: true, data: reply });
  })
);

router.post(
  "/reviews/:id/report",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);
    const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);
    const review = await prisma.review.findFirst({ where: { id, shopId: shop.id } });
    if (!review) throw httpError(404, "Không tìm thấy review");
    // seller dùng luôn ReviewReport với reporterId là seller user
    const created = await prisma.reviewReport.create({ data: { reviewId: id, reporterId: req.user.sub, reason: body.reason } });
    res.status(201).json({ success: true, data: created });
  })
);

// --- Analytics (simple) ---
router.get(
  "/analytics/summary",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const orders = await prisma.order.findMany({ where: { shopId: shop.id, createdAt: { gte: from, lte: to } } });
    const revenue = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + o.total, 0);
    res.json({
      success: true,
      data: {
        from,
        to,
        orders: orders.length,
        revenue,
      },
    });
  })
);

module.exports = router;
