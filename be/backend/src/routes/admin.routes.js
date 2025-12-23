const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { slugify } = require("../utils/slugify");
const { z } = require("zod");
const { refundPayment } = require("../services/payment.service");
const { updateShipmentStatus } = require("../services/shipping.service");
const { audit } = require("../services/audit.service");
const { notify } = require("../services/notification.service");

// Require ADMIN or CS
router.use(requireAuth, requireRole("ADMIN", "CS"));

// --- Users ---
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const role = (req.query.role || "").toString().trim();
    const where = {};
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { username: { contains: q } },
        { name: { contains: q } },
      ];
    }
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, username: true, name: true, role: true, isBlocked: true, createdAt: true },
      take: 200,
    });
    res.json({ success: true, data: users });
  })
);

// Only ADMIN can change roles
router.put(
  "/users/:id/role",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ role: z.enum(["CUSTOMER", "SELLER", "ADMIN", "CS"]) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, "Không tìm thấy user");
    const updated = await prisma.user.update({ where: { id }, data: { role: body.role } });
    await audit(req.user.sub, "USER_ROLE_UPDATE", "User", id, { role: body.role });
    res.json({ success: true, message: "Đã cập nhật role", data: { id: updated.id, role: updated.role } });
  })
);

router.put(
  "/users/:id/block",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ isBlocked: z.boolean() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw httpError(404, "Không tìm thấy user");
    const updated = await prisma.user.update({ where: { id }, data: { isBlocked: body.isBlocked } });
    await audit(req.user.sub, body.isBlocked ? "USER_BLOCK" : "USER_UNBLOCK", "User", id, {});
    res.json({ success: true, message: "Đã cập nhật", data: { id: updated.id, isBlocked: updated.isBlocked } });
  })
);

// --- Seller KYC ---
router.get(
  "/sellers",
  asyncHandler(async (req, res) => {
    const status = (req.query.status || "").toString().trim();
    const where = {};
    if (status) where.status = status;
    const list = await prisma.sellerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, username: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: list });
  })
);

router.put(
  "/sellers/:userId/approve",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) throw httpError(404, "Không tìm thấy hồ sơ seller");

    const shop = await prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw httpError(400, "Seller chưa tạo shop");

    await prisma.$transaction([
      prisma.sellerProfile.update({ where: { userId }, data: { status: "APPROVED" } }),
      prisma.user.update({ where: { id: userId }, data: { role: "SELLER" } }),
      prisma.shop.update({ where: { id: shop.id }, data: { status: "ACTIVE" } }),
    ]);

    await audit(req.user.sub, "SELLER_APPROVE", "User", userId, {});
    await notify(userId, { type: "SELLER_APPROVED", title: "Shop đã được duyệt", body: "Bạn có thể bắt đầu bán hàng", data: { shopSlug: shop.slug } });
    res.json({ success: true, message: "Đã duyệt seller" });
  })
);

router.put(
  "/sellers/:userId/reject",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const body = z.object({ reason: z.string().min(3).max(500).optional() }).parse(req.body);
    const profile = await prisma.sellerProfile.findUnique({ where: { userId } });
    if (!profile) throw httpError(404, "Không tìm thấy hồ sơ seller");
    await prisma.sellerProfile.update({ where: { userId }, data: { status: "REJECTED" } });
    await audit(req.user.sub, "SELLER_REJECT", "User", userId, { reason: body.reason });
    await notify(userId, { type: "SELLER_REJECTED", title: "Shop bị từ chối", body: body.reason || "Vui lòng bổ sung hồ sơ", data: {} });
    res.json({ success: true, message: "Đã từ chối seller" });
  })
);

// --- Categories ---
const categorySchema = z.object({
  name: z.string().min(2),
  parentId: z.number().int().positive().optional(),
});

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const cats = await prisma.category.findMany({ orderBy: { name: "asc" }, include: { children: true } });
    res.json({ success: true, data: cats });
  })
);

router.post(
  "/categories",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = categorySchema.parse(req.body);
    const baseSlug = slugify(body.name);
    let slug = baseSlug;
    const exists = await prisma.category.findUnique({ where: { slug } });
    if (exists) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
    const created = await prisma.category.create({ data: { name: body.name, slug, parentId: body.parentId || null } });
    await audit(req.user.sub, "CATEGORY_CREATE", "Category", created.id, { name: created.name });
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  "/categories/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = categorySchema.partial().parse(req.body);
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) throw httpError(404, "Không tìm thấy category");
    const data = { ...body };
    if (body.name && body.name !== cat.name) {
      const baseSlug = slugify(body.name);
      let slug = baseSlug;
      const exists = await prisma.category.findUnique({ where: { slug } });
      if (exists && exists.id !== id) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;
      data.slug = slug;
    }
    const updated = await prisma.category.update({ where: { id }, data });
    await audit(req.user.sub, "CATEGORY_UPDATE", "Category", id, data);
    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/categories/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.category.delete({ where: { id } });
    await audit(req.user.sub, "CATEGORY_DELETE", "Category", id, {});
    res.json({ success: true });
  })
);

// --- Product moderation ---
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const status = (req.query.status || "").toString().trim();
    const where = {};
    if (status) where.status = status;
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { shop: { select: { id: true, name: true, slug: true } }, category: true },
      take: 200,
    });
    res.json({ success: true, data: products });
  })
);

router.put(
  "/products/:id/status",
  asyncHandler(async (req, res) => {
    // CS cũng có thể ẩn
    const id = Number(req.params.id);
    const body = z.object({ status: z.enum(["ACTIVE", "HIDDEN", "BANNED", "DRAFT"]) }).parse(req.body);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw httpError(404, "Không tìm thấy sản phẩm");
    const updated = await prisma.product.update({ where: { id }, data: { status: body.status } });
    await audit(req.user.sub, "PRODUCT_MODERATE", "Product", id, { status: body.status });
    res.json({ success: true, data: updated });
  })
);

// --- Orders monitor ---
router.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const status = (req.query.status || "").toString().trim();
    const where = {};
    if (status) where.status = status;
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, username: true } }, shop: { select: { id: true, name: true } }, shipment: true },
      take: 200,
    });
    res.json({ success: true, data: orders });
  })
);

router.post(
  "/orders/:code/force-cancel",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const order = await prisma.order.findUnique({ where: { code }, include: { items: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (order.status === "CANCELLED") return res.json({ success: true, message: "Đơn đã huỷ" });
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      // restock
      for (const it of order.items) {
        await tx.sKU.update({ where: { id: it.skuId }, data: { stock: { increment: it.qty } } });
      }
      await tx.refund.upsert({
        where: { orderId: order.id },
        update: { status: "REQUESTED", amount: order.total, processedById: req.user.sub },
        create: { orderId: order.id, amount: order.total, status: "REQUESTED", processedById: req.user.sub },
      });
    });

    await audit(req.user.sub, "ORDER_FORCE_CANCEL", "Order", order.id, {});
    await notify(order.userId, { type: "ORDER_CANCELLED", title: `Đơn ${order.code} bị huỷ bởi hệ thống`, body: "CS đã can thiệp huỷ đơn", data: { orderCode: order.code } });
    res.json({ success: true, message: "Đã force cancel" });
  })
);

// Shipment override
router.post(
  "/orders/:code/shipment-override",
  asyncHandler(async (req, res) => {
    const code = req.params.code;
    const body = z.object({ status: z.enum(["PENDING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED"]), message: z.string().optional() }).parse(req.body);
    const order = await prisma.order.findUnique({ where: { code }, include: { shipment: true } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    if (!order.shipment) throw httpError(400, "Đơn chưa có vận đơn");
    const shipment = await updateShipmentStatus(order.shipment.id, body.status, body.message);
    await audit(req.user.sub, "SHIP_OVERRIDE", "Shipment", order.shipment.id, { status: body.status });
    res.json({ success: true, data: shipment });
  })
);

// --- Disputes ---
router.get(
  "/disputes",
  asyncHandler(async (req, res) => {
    const list = await prisma.dispute.findMany({
      orderBy: { createdAt: "desc" },
      include: { order: { include: { user: { select: { id: true, username: true } }, shop: { select: { id: true, name: true } } } } },
      take: 200,
    });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/disputes/:id/resolve",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z.object({ status: z.enum(["RESOLVED", "REJECTED"]), resolution: z.string().min(3).max(2000).optional(), approveRefund: z.boolean().optional() }).parse(req.body);
    const dispute = await prisma.dispute.findUnique({ where: { id }, include: { order: true } });
    if (!dispute) throw httpError(404, "Không tìm thấy dispute");

    await prisma.dispute.update({ where: { id }, data: { status: body.status, resolution: body.resolution || null, resolvedById: req.user.sub, resolvedAt: new Date() } });

    if (body.approveRefund) {
      await prisma.refund.upsert({
        where: { orderId: dispute.orderId },
        update: { status: "APPROVED", processedById: req.user.sub, reason: "Dispute resolution" },
        create: { orderId: dispute.orderId, amount: dispute.order.total, status: "APPROVED", processedById: req.user.sub, reason: "Dispute resolution" },
      });
      await prisma.order.update({ where: { id: dispute.orderId }, data: { status: "REFUND_REQUESTED" } });
    }

    await audit(req.user.sub, "DISPUTE_RESOLVE", "Dispute", id, body);
    await notify(dispute.userId, { type: "DISPUTE_UPDATE", title: `Tranh chấp đơn ${dispute.order.code}`, body: body.resolution || body.status, data: { orderCode: dispute.order.code } });
    res.json({ success: true, message: "Đã xử lý dispute" });
  })
);

// --- Refunds ---
router.get(
  "/refunds",
  asyncHandler(async (req, res) => {
    const list = await prisma.refund.findMany({ orderBy: { createdAt: "desc" }, include: { order: true }, take: 200 });
    res.json({ success: true, data: list });
  })
);

// Approve refund (CS or ADMIN)
router.post(
  "/refunds/:orderCode/approve",
  asyncHandler(async (req, res) => {
    const orderCode = req.params.orderCode;
    const order = await prisma.order.findUnique({ where: { code: orderCode } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    const refund = await prisma.refund.upsert({
      where: { orderId: order.id },
      update: { status: "APPROVED", processedById: req.user.sub },
      create: { orderId: order.id, amount: order.total, status: "APPROVED", processedById: req.user.sub },
    });
    await audit(req.user.sub, "REFUND_APPROVE", "Refund", refund.id, { orderCode });
    res.json({ success: true, data: refund });
  })
);

// Execute refund via payment gateway
router.post(
  "/refunds/:orderCode/execute",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const orderCode = req.params.orderCode;
    const order = await prisma.order.findUnique({ where: { code: orderCode } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    const refundRow = await prisma.refund.findUnique({ where: { orderId: order.id } });
    if (!refundRow) throw httpError(404, "Không có yêu cầu hoàn");

    const result = await refundPayment(order.id, order.total);

    const updated = await prisma.refund.update({
      where: { orderId: order.id },
      data: { status: result.ok ? "SUCCESS" : "FAILED", providerRef: result.ok ? result.providerRef : null, processedById: req.user.sub },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: result.ok ? "REFUNDED" : "REFUND_REQUESTED" } });
    await audit(req.user.sub, "REFUND_EXECUTE", "Refund", updated.id, { ok: result.ok });
    await notify(order.userId, { type: "REFUND_UPDATE", title: `Hoàn tiền đơn ${order.code}`, body: result.ok ? "Hoàn tiền thành công" : "Hoàn tiền thất bại", data: { orderCode: order.code } });
    res.json({ success: true, data: updated });
  })
);

// Manual refund for COD
router.post(
  "/refunds/:orderCode/manual",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const orderCode = req.params.orderCode;
    const order = await prisma.order.findUnique({ where: { code: orderCode } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");
    const body = z.object({ note: z.string().optional() }).parse(req.body);
    const updated = await prisma.refund.upsert({
      where: { orderId: order.id },
      update: { status: "SUCCESS", provider: "MANUAL", providerRef: body.note || null, processedById: req.user.sub },
      create: { orderId: order.id, amount: order.total, status: "SUCCESS", provider: "MANUAL", providerRef: body.note || null, processedById: req.user.sub },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
    await audit(req.user.sub, "REFUND_MANUAL", "Refund", updated.id, body);
    res.json({ success: true, data: updated });
  })
);

// --- Review moderation ---
router.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const status = (req.query.status || "").toString().trim();
    const where = {};
    if (status) where.status = status;
    const list = await prisma.review.findMany({ where, include: { user: { select: { id: true, username: true } }, product: true, shop: true }, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ success: true, data: list });
  })
);

router.put(
  "/reviews/:id/hide",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw httpError(404, "Không tìm thấy review");
    const updated = await prisma.review.update({ where: { id }, data: { status: "HIDDEN" } });
    await audit(req.user.sub, "REVIEW_HIDE", "Review", id, {});
    res.json({ success: true, data: updated });
  })
);

router.get(
  "/review-reports",
  asyncHandler(async (req, res) => {
    const list = await prisma.reviewReport.findMany({ include: { review: true, reporter: { select: { id: true, username: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ success: true, data: list });
  })
);

router.put(
  "/review-reports/:id/resolve",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const updated = await prisma.reviewReport.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    await audit(req.user.sub, "REVIEW_REPORT_RESOLVE", "ReviewReport", id, {});
    res.json({ success: true, data: updated });
  })
);

// --- Promo / Voucher ---
const voucherSchema = z.object({
  code: z.string().min(3).max(50),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  minSubtotal: z.number().int().nonnegative().optional(),
  maxDiscount: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
});

router.get(
  "/vouchers",
  asyncHandler(async (req, res) => {
    const list = await prisma.voucher.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/vouchers",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = voucherSchema.parse(req.body);
    const created = await prisma.voucher.create({
      data: {
        code: body.code,
        type: body.type,
        value: body.value,
        minSubtotal: body.minSubtotal || 0,
        maxDiscount: body.maxDiscount || null,
        isActive: body.isActive ?? true,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        usageLimit: body.usageLimit || null,
      },
    });
    await audit(req.user.sub, "VOUCHER_CREATE", "Voucher", created.id, { code: created.code });
    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  "/vouchers/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = voucherSchema.partial().parse(req.body);
    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        ...body,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
      },
    });
    await audit(req.user.sub, "VOUCHER_UPDATE", "Voucher", id, body);
    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/vouchers/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.voucher.delete({ where: { id } });
    await audit(req.user.sub, "VOUCHER_DELETE", "Voucher", id, {});
    res.json({ success: true });
  })
);

// --- Audit logs ---
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const list = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { id: true, username: true, role: true } } } });
    res.json({ success: true, data: list });
  })
);

// --- Settings (policies, fees, ...)
router.get(
  "/settings/:key",
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    const setting = await prisma.setting.findUnique({ where: { key } });
    res.json({ success: true, data: setting ? JSON.parse(setting.valueJson) : null });
  })
);

router.put(
  "/settings/:key",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const key = req.params.key;
    const valueJson = JSON.stringify(req.body || {});
    await prisma.setting.upsert({ where: { key }, update: { valueJson }, create: { key, valueJson } });
    await audit(req.user.sub, "SETTING_UPDATE", "Setting", key, {});
    res.json({ success: true });
  })
);

module.exports = router;
