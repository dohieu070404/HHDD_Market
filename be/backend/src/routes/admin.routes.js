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

    // Join shop info (Shop.ownerId == SellerProfile.userId)
    const ownerIds = list.map((p) => p.userId);
    const shops = await prisma.shop.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { id: true, ownerId: true, name: true, slug: true, status: true, createdAt: true },
    });
    const shopMap = new Map(shops.map((s) => [s.ownerId, s]));

    const data = list.map((p) => ({
      ...p,
      shop: shopMap.get(p.userId) || null,
    }));

    res.json({ success: true, data });
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
      prisma.sellerProfile.update({ where: { userId }, data: { status: "APPROVED", rejectedReason: null } }),
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
    const shop = await prisma.shop.findUnique({ where: { ownerId: userId } });

    // Chỉ từ chối khi hồ sơ đang PENDING
    if (profile.status === "APPROVED") throw httpError(400, "Seller đã được duyệt. Nếu cần xử lý, hãy dùng chức năng khoá shop.");

    await prisma.$transaction([
      prisma.sellerProfile.update({ where: { userId }, data: { status: "REJECTED", rejectedReason: body.reason || "Hồ sơ chưa đạt yêu cầu" } }),
      prisma.user.update({ where: { id: userId }, data: { role: "CUSTOMER" } }),
      shop ? prisma.shop.update({ where: { id: shop.id }, data: { status: "REJECTED" } }) : prisma.shop.create({ data: { ownerId: userId, name: profile.shopName, slug: slugify(profile.shopName) + "-" + Math.random().toString(16).slice(2, 6), status: "REJECTED" } }),
    ]);
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

// --- Shops (helper for admin UIs) ---
router.get(
  "/shops",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const status = (req.query.status || "").toString().trim();

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [{ name: { contains: q } }, { slug: { contains: q } }],
          }
        : {}),
    };

    const shops = await prisma.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        ownerId: true,
        name: true,
        slug: true,
        status: true,
        moderationNote: true,
        suspendedAt: true,
        suspensionUntil: true,
        bannedAt: true,
        violationPoints: true,
        warningLevel: true,
        strikes: true,
        lastModeratedAt: true,
        createdAt: true,
        owner: { select: { id: true, email: true, username: true, role: true } },
      },
    });

    const ids = shops.map((s) => s.id);
    const reportCounts = ids.length
      ? await prisma.shopReport.groupBy({
          by: ["shopId"],
          where: { shopId: { in: ids }, status: "OPEN" },
          _count: { _all: true },
        })
      : [];
    const map = new Map(reportCounts.map((r) => [r.shopId, r._count._all]));

    // Valid/invalid ratio in last 60 days (only resolved reports)
    const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const ids2 = shops.map((s) => s.id);
    const validAgg = ids2.length
      ? await prisma.shopReport.groupBy({
          by: ["shopId"],
          where: {
            shopId: { in: ids2 },
            createdAt: { gte: since60d },
            resolution: "VALID",
          },
          _count: { _all: true },
        })
      : [];
    const invalidAgg = ids2.length
      ? await prisma.shopReport.groupBy({
          by: ["shopId"],
          where: {
            shopId: { in: ids2 },
            createdAt: { gte: since60d },
            resolution: "INVALID",
          },
          _count: { _all: true },
        })
      : [];
    const validMap = new Map(validAgg.map((r) => [r.shopId, r._count._all]));
    const invalidMap = new Map(invalidAgg.map((r) => [r.shopId, r._count._all]));

    res.json({
      success: true,
      data: shops.map((s) => {
        const v = validMap.get(s.id) || 0;
        const inv = invalidMap.get(s.id) || 0;
        const denom = v + inv;
        const ratio = denom >= 5 ? Math.round((v / denom) * 1000) / 1000 : null;
        return {
          ...s,
          openReportCount: map.get(s.id) || 0,
          validReportCount60d: v,
          invalidReportCount60d: inv,
          validRatio60d: ratio,
        };
      }),
    });
  })
);

// Update shop status (moderation)
router.put(
  "/shops/:id/status",
  requireRole("ADMIN", "CS"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z
      .object({
        status: z.enum(["ACTIVE", "SUSPENDED", "REJECTED", "PENDING", "HIDDEN", "BANNED"]),
        suspensionDays: z.number().int().min(1).max(365).optional(),
        moderationNote: z.string().trim().min(3).max(2000).optional(),
      })
      .parse(req.body);

    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) throw httpError(404, "Không tìm thấy shop");

    const now = new Date();
    const suspensionUntil =
      body.status === "SUSPENDED" ? new Date(now.getTime() + (body.suspensionDays || 7) * 24 * 60 * 60 * 1000) : null;

    const updated = await prisma.shop.update({
      where: { id },
      data: {
        status: body.status,
        moderationNote: body.moderationNote ?? shop.moderationNote,
        suspendedAt: body.status === "SUSPENDED" ? now : null,
        suspensionUntil,
        bannedAt: body.status === "BANNED" ? now : null,
        lastModeratedAt: now,
      },
    });

    await prisma.shopModerationEvent.create({
      data: {
        shopId: id,
        actorId: req.user.sub,
        action:
          body.status === "BANNED"
            ? "BAN"
            : body.status === "HIDDEN"
            ? "HIDE"
            : body.status === "SUSPENDED"
            ? (body.suspensionDays || 7) >= 30
              ? "SUSPEND_30D"
              : "SUSPEND_7D"
            : "UNHIDE",
        pointsDelta: 0,
        note: body.moderationNote || null,
        meta: { status: body.status, suspensionDays: body.suspensionDays || null },
      },
    });

    await audit(req.user.sub, "SHOP_STATUS_UPDATE", "Shop", id, { status: body.status, moderationNote: body.moderationNote });
    await notify(shop.ownerId, {
      type: "SHOP_STATUS_UPDATE",
      title:
        body.status === "BANNED"
          ? "Shop bị khoá vĩnh viễn"
          : body.status === "SUSPENDED"
          ? "Shop bị tạm khoá"
          : body.status === "HIDDEN"
          ? "Shop bị ẩn"
          : "Shop được cập nhật trạng thái",
      body:
        body.moderationNote ||
        (body.status === "SUSPENDED" ? `Shop bị tạm khoá đến ${suspensionUntil?.toISOString()}` : "Trạng thái shop đã được cập nhật"),
      data: { shopSlug: shop.slug, status: body.status },
    });

    res.json({ success: true, data: updated });
  })
);

// Manual moderation (points/strikes/enforcement)
router.put(
  "/shops/:id/moderate",
  requireRole("ADMIN", "CS"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z
      .object({
        action: z.enum(["WARN_1", "WARN_2", "WARN_3", "SUSPEND_7D", "SUSPEND_30D", "HIDE", "UNHIDE", "BAN", "UNBAN", "ADJUST_POINTS"]),
        pointsDelta: z.number().int().min(-100).max(100).optional(),
        note: z.string().trim().min(3).max(2000).optional(),
      })
      .parse(req.body);

    const shop = await prisma.shop.findUnique({ where: { id } });
    if (!shop) throw httpError(404, "Không tìm thấy shop");

    const now = new Date();
    const delta = body.pointsDelta || 0;
    const newPoints = Math.max(0, (shop.violationPoints || 0) + delta);
    let warningLevel = shop.warningLevel || 0;
    if (newPoints >= 15) warningLevel = Math.max(warningLevel, 3);
    else if (newPoints >= 10) warningLevel = Math.max(warningLevel, 2);
    else if (newPoints >= 5) warningLevel = Math.max(warningLevel, 1);

    let nextStatus = shop.status;
    let suspendedAt = shop.suspendedAt;
    let suspensionUntil = shop.suspensionUntil;
    let bannedAt = shop.bannedAt;
    let strikes = shop.strikes || 0;

    if (body.action === "HIDE") nextStatus = "HIDDEN";
    if (body.action === "UNHIDE" && shop.status === "HIDDEN") nextStatus = "ACTIVE";
    if (body.action === "UNBAN" && shop.status === "BANNED") {
      nextStatus = "ACTIVE";
      bannedAt = null;
      strikes = 0;
    }
    if (body.action === "BAN") {
      nextStatus = "BANNED";
      bannedAt = now;
      strikes = 3;
      suspendedAt = null;
      suspensionUntil = null;
    }
    if (body.action === "SUSPEND_7D" || body.action === "SUSPEND_30D") {
      nextStatus = "SUSPENDED";
      suspendedAt = now;
      const days = body.action === "SUSPEND_30D" ? 30 : 7;
      suspensionUntil = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      strikes = Math.min(3, strikes + 1);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s2 = await tx.shop.update({
        where: { id },
        data: {
          status: nextStatus,
          violationPoints: newPoints,
          warningLevel,
          strikes,
          suspendedAt: nextStatus === "SUSPENDED" ? suspendedAt : null,
          suspensionUntil: nextStatus === "SUSPENDED" ? suspensionUntil : null,
          bannedAt: nextStatus === "BANNED" ? bannedAt : null,
          moderationNote: body.note ?? shop.moderationNote,
          lastModeratedAt: now,
        },
      });
      await tx.shopModerationEvent.create({
        data: {
          shopId: id,
          actorId: req.user.sub,
          action: body.action,
          pointsDelta: delta,
          note: body.note || null,
          meta: { status: nextStatus, warningLevel, strikes },
        },
      });
      return s2;
    });

    await audit(req.user.sub, "SHOP_MODERATE", "Shop", id, { action: body.action, pointsDelta: delta });
    await notify(shop.ownerId, {
      type: "SHOP_MODERATION",
      title: "Shop bị cập nhật chế tài",
      body: body.note || `Action: ${body.action}`,
      data: { shopSlug: shop.slug, action: body.action, violationPoints: newPoints, warningLevel, strikes },
    });

    res.json({ success: true, data: updated });
  })
);

// --- Shop reports ---
router.get(
  "/shop-reports",
  asyncHandler(async (req, res) => {
    const status = (req.query.status || "").toString().trim();
    const shopId = req.query.shopId ? Number(req.query.shopId) : null;

    const where = {
      ...(status ? { status } : {}),
      ...(shopId ? { shopId } : {}),
    };

    const list = await prisma.shopReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        shop: { select: { id: true, name: true, slug: true, status: true } },
        reporter: { select: { id: true, email: true, username: true, name: true } },
        resolvedBy: { select: { id: true, email: true, username: true } },
      },
    });
    res.json({ success: true, data: list });
  })
);

router.put(
  "/shop-reports/:id/resolve",
  requireRole("ADMIN", "CS"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = z
      .object({
        resolution: z.enum(["VALID", "INVALID", "ABUSIVE", "DUPLICATE"]),
        severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
        pointsApplied: z.number().int().min(0).max(100).optional(),
        note: z.string().trim().min(3).max(2000).optional(),
      })
      .parse(req.body);

    const existing = await prisma.shopReport.findUnique({ where: { id }, include: { shop: true } });
    if (!existing) throw httpError(404, "Không tìm thấy report");
    if (existing.status !== "OPEN") throw httpError(400, "Báo cáo này đã được xử lý");

    const severity = body.severity || existing.severity || "LOW";
    const severityPoints = { LOW: 1, MEDIUM: 3, HIGH: 5, CRITICAL: 8 };
    const points = body.resolution === "VALID" ? body.pointsApplied ?? severityPoints[severity] : 0;

    const now = new Date();
    const nextStatus = body.resolution === "VALID" ? "RESOLVED" : "DISMISSED";

    const updated = await prisma.$transaction(async (tx) => {
      const reportUpdated = await tx.shopReport.update({
        where: { id },
        data: {
          status: nextStatus,
          resolution: body.resolution,
          severity,
          pointsApplied: points,
          resolutionNote: body.note || null,
          resolvedAt: now,
          resolvedById: req.user.sub,
        },
      });

      // Apply moderation points when report is VALID
      if (body.resolution === "VALID") {
        const shop = existing.shop;
        const newPoints = (shop.violationPoints || 0) + points;
        let warningLevel = shop.warningLevel || 0;
        if (newPoints >= 15) warningLevel = Math.max(warningLevel, 3);
        else if (newPoints >= 10) warningLevel = Math.max(warningLevel, 2);
        else if (newPoints >= 5) warningLevel = Math.max(warningLevel, 1);

        // Ratio-based auto enforcement (verified purchase reports only)
        const since60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const validCount = await tx.shopReport.count({
          where: {
            shopId: shop.id,
            createdAt: { gte: since60d },
            isVerifiedPurchase: true,
            resolution: "VALID",
          },
        });
        const invalidCount = await tx.shopReport.count({
          where: {
            shopId: shop.id,
            createdAt: { gte: since60d },
            isVerifiedPurchase: true,
            resolution: "INVALID",
          },
        });
        const denom = validCount + invalidCount;
        const ratio = denom > 0 ? validCount / denom : 0;

        // Escalation ladder (like Shopee: warnings -> suspensions -> ban)
        // Points-based OR high valid-ratio based (to avoid report abuse)
        let action = null;
        let statusUpdate = null;
        let suspensionDays = null;

        if (newPoints >= 40 || (shop.strikes || 0) >= 3) {
          action = "BAN";
          statusUpdate = "BANNED";
        } else if (newPoints >= 30 || (validCount >= 8 && denom >= 10 && ratio >= 0.85)) {
          action = "SUSPEND_30D";
          statusUpdate = "SUSPENDED";
          suspensionDays = 30;
        } else if (newPoints >= 20 || (validCount >= 5 && denom >= 7 && ratio >= 0.8)) {
          action = "SUSPEND_7D";
          statusUpdate = "SUSPENDED";
          suspensionDays = 7;
        } else if (warningLevel === 3 && (shop.warningLevel || 0) < 3) {
          action = "WARN_3";
        } else if (warningLevel === 2 && (shop.warningLevel || 0) < 2) {
          action = "WARN_2";
        } else if (warningLevel === 1 && (shop.warningLevel || 0) < 1) {
          action = "WARN_1";
        }

        const strikesInc = action && (action === "SUSPEND_7D" || action === "SUSPEND_30D") ? 1 : 0;
        const strikes = Math.min(3, (shop.strikes || 0) + strikesInc);

        const shopUpdated = await tx.shop.update({
          where: { id: shop.id },
          data: {
            violationPoints: newPoints,
            warningLevel,
            strikes,
            lastModeratedAt: now,
            ...(statusUpdate
              ? {
                  status: statusUpdate,
                  suspendedAt: statusUpdate === "SUSPENDED" ? now : null,
                  suspensionUntil:
                    statusUpdate === "SUSPENDED" && suspensionDays
                      ? new Date(now.getTime() + suspensionDays * 24 * 60 * 60 * 1000)
                      : null,
                  bannedAt: statusUpdate === "BANNED" ? now : null,
                  moderationNote: body.note || shop.moderationNote,
                }
              : {}),
          },
        });

        await tx.shopModerationEvent.create({
          data: {
            shopId: shop.id,
            actorId: req.user.sub,
            action: action || "ADJUST_POINTS",
            pointsDelta: points,
            note: body.note || null,
            meta: { reportId: id, resolution: body.resolution, severity, ratio60d: denom ? ratio : null, validCount, invalidCount },
          },
        });

        // Notify shop owner when an enforcement action happened
        if (action && ["WARN_1", "WARN_2", "WARN_3", "SUSPEND_7D", "SUSPEND_30D", "BAN"].includes(action)) {
          await notify(shop.ownerId, {
            type: "SHOP_MODERATION",
            title:
              action === "BAN"
                ? "Shop bị khoá vĩnh viễn"
                : action.startsWith("SUSPEND")
                ? "Shop bị tạm khoá"
                : "Cảnh cáo vi phạm",
            body:
              body.note ||
              (action === "BAN"
                ? "Shop bị khoá do vi phạm nhiều lần."
                : action === "SUSPEND_30D"
                ? "Shop bị tạm khoá 30 ngày do vi phạm."
                : action === "SUSPEND_7D"
                ? "Shop bị tạm khoá 7 ngày do vi phạm."
                : "Shop đã nhận một cảnh cáo vi phạm."),
            data: { shopSlug: shop.slug, action, violationPoints: newPoints, warningLevel, strikes },
          });
        }

        return { reportUpdated, shopUpdated };
      }

      // Non-valid reports: just update report + audit
      await tx.shopModerationEvent.create({
        data: {
          shopId: existing.shopId,
          actorId: req.user.sub,
          action: "ADJUST_POINTS",
          pointsDelta: 0,
          note: body.note || null,
          meta: { reportId: id, resolution: body.resolution },
        },
      });
      return { reportUpdated, shopUpdated: null };
    });

    await audit(req.user.sub, "SHOP_REPORT_RESOLVE", "ShopReport", id, { resolution: body.resolution, severity, points });
    res.json({ success: true, data: updated.reportUpdated, shop: updated.shopUpdated });
  })
);

// --- Vouchers (platform) ---
const voucherSchema = z.object({
  code: z.string().trim().min(3).max(50),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  minSubtotal: z.number().int().nonnegative().optional(),
  maxDiscount: z.number().int().positive().optional().nullable(),
  minBuyerSpendMonth: z.number().int().nonnegative().optional(),
  minBuyerSpendYear: z.number().int().nonnegative().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

router.get(
  "/vouchers",
  asyncHandler(async (req, res) => {
    const list = await prisma.voucher.findMany({ orderBy: { id: "desc" } });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/vouchers",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const body = voucherSchema.parse(req.body);
    if (body.type === "PERCENT" && body.value > 100) throw httpError(400, "PERCENT tối đa 100");

    const created = await prisma.voucher.create({
      data: {
        code: body.code,
        type: body.type,
        value: body.value,
        minSubtotal: body.minSubtotal ?? 0,
        maxDiscount: body.maxDiscount ?? null,
        minBuyerSpendMonth: body.minBuyerSpendMonth ?? 0,
        minBuyerSpendYear: body.minBuyerSpendYear ?? 0,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        usageLimit: body.usageLimit ?? null,
        isActive: body.isActive ?? true,
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
    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) throw httpError(404, "Không tìm thấy voucher");
    if (body.type === "PERCENT" && body.value != null && body.value > 100) throw httpError(400, "PERCENT tối đa 100");

    const updated = await prisma.voucher.update({
      where: { id },
      data: {
        code: body.code ?? existing.code,
        type: body.type ?? existing.type,
        value: body.value ?? existing.value,
        minSubtotal: body.minSubtotal ?? existing.minSubtotal,
        maxDiscount: body.maxDiscount === undefined ? existing.maxDiscount : body.maxDiscount,
        minBuyerSpendMonth: body.minBuyerSpendMonth ?? existing.minBuyerSpendMonth,
        minBuyerSpendYear: body.minBuyerSpendYear ?? existing.minBuyerSpendYear,
        startAt: body.startAt ? new Date(body.startAt) : existing.startAt,
        endAt: body.endAt ? new Date(body.endAt) : existing.endAt,
        usageLimit: body.usageLimit === undefined ? existing.usageLimit : body.usageLimit,
        isActive: body.isActive ?? existing.isActive,
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
    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) throw httpError(404, "Không tìm thấy voucher");
    const updated = await prisma.voucher.update({ where: { id }, data: { isActive: false } });
    await audit(req.user.sub, "VOUCHER_DEACTIVATE", "Voucher", id, {});
    res.json({ success: true, data: updated });
  })
);

// --- Shop vouchers ---
// Theo yêu cầu minh bạch: admin **không** quản lý voucher của shop.
// Voucher shop do SELLER quản lý, admin chỉ quản lý voucher sàn (/vouchers).
router.all(
  ["/shop-vouchers", "/shop-vouchers/:id"],
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    res.status(403).json({
      success: false,
      message: "Admin chỉ quản lý voucher sàn. Voucher shop do người bán tự quản lý.",
    });
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
      include: {
        user: { select: { id: true, username: true, email: true } },
        revisionRequestedBy: { select: { id: true, username: true, email: true, role: true } },
        order: {
          include: {
            user: { select: { id: true, username: true } },
            shop: { select: { id: true, name: true, slug: true, ownerId: true } },
          },
        },
      },
      take: 200,
    });

    const withMedia = (list || []).map((d) => ({
      ...d,
      mediaUrls: d.mediaUrlsJson
        ? (() => {
            try {
              const arr = JSON.parse(d.mediaUrlsJson);
              return Array.isArray(arr) ? arr : [];
            } catch {
              return [];
            }
          })()
        : [],
    }));

    res.json({ success: true, data: withMedia });
  })
);

// Resolve / finalize dispute
// Admin only needs to APPROVE (RESOLVED) or REJECT.
// Editing a finalized dispute is only allowed ONCE and only when there is a revision request.
const disputeResolveSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]).optional(),
    status: z.enum(["RESOLVED", "REJECTED"]).optional(),
    resolution: z.string().trim().min(3).max(2000).optional(),
  })
  .refine((v) => !!(v.decision || v.status), { message: "Thiếu quyết định" });

const resolveDisputeHandler = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const body = disputeResolveSchema.parse(req.body);

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: { include: { shop: { select: { id: true, slug: true, ownerId: true }, }, }, },
    },
  });
  if (!dispute) throw httpError(404, "Không tìm thấy khiếu nại");

  const nextStatus = body.status || (body.decision === "APPROVE" ? "RESOLVED" : "REJECTED");
  const isFinal = dispute.status === "RESOLVED" || dispute.status === "REJECTED";

  if (isFinal) {
    // Allow admin edit only once AND only when there is a revision request.
    if (!dispute.revisionRequestedAt) throw httpError(400, "Khiếu nại đã xử lý. Chỉ được sửa khi có yêu cầu xem lại.");
    if (Number(dispute.editCount || 0) >= 1) throw httpError(400, "Khiếu nại này đã được sửa 1 lần (tối đa 1 lần).");
  }

  const updated = await prisma.dispute.update({
    where: { id },
    data: {
      status: nextStatus,
      resolution: body.resolution ?? dispute.resolution ?? null,
      resolvedById: req.user.sub,
      resolvedAt: new Date(),
      ...(isFinal
        ? {
            editCount: { increment: 1 },
            revisionRequestedAt: null,
            revisionRequestedById: null,
            revisionRequestedByRole: null,
            revisionRequestNote: null,
          }
        : {}),
    },
  });

  await audit(req.user.sub, isFinal ? "DISPUTE_EDIT" : "DISPUTE_RESOLVE", "Dispute", id, { ...body, nextStatus });

  // Notify customer
  await notify(dispute.userId, {
    type: "DISPUTE_UPDATE",
    title: `Khiếu nại đơn ${dispute.order.code}`,
    body: body.resolution || nextStatus,
    data: { orderCode: dispute.order.code, disputeId: id, status: nextStatus },
  });

  // Notify shop owner (seller)
  if (dispute.order?.shop?.ownerId) {
    await notify(dispute.order.shop.ownerId, {
      type: "DISPUTE_UPDATE",
      title: `Khiếu nại đơn ${dispute.order.code}`,
      body: body.resolution || nextStatus,
      data: { orderCode: dispute.order.code, disputeId: id, status: nextStatus, shopSlug: dispute.order.shop.slug },
    });
  }

  res.json({ success: true, message: isFinal ? "Đã sửa kết quả khiếu nại" : "Đã xử lý khiếu nại", data: updated });
});

// Backward-compat: accept both PUT and POST
router.put("/disputes/:id/resolve", resolveDisputeHandler);
router.post("/disputes/:id/resolve", resolveDisputeHandler);


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
