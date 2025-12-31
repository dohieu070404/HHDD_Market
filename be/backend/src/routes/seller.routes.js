const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const { withIdempotency } = require("../middleware/idempotency.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const { httpError } = require("../utils/httpError");
const { z } = require("zod");
const { slugify } = require("../utils/slugify");
const { createShipment, updateShipmentStatus } = require("../services/shipping.service");
const { refundPayment } = require("../services/payment.service");
const { notify } = require("../services/notification.service");
const { imageUpload, excelUpload } = require("../middleware/upload.middleware");
const XLSX = require("xlsx");

// Require SELLER or ADMIN
router.use(requireAuth, requireRole("SELLER", "ADMIN"));

async function getMyShop(userId) {
  const owned = await prisma.shop.findUnique({ where: { ownerId: userId } });
  if (owned) return owned;

  const member = await prisma.shopMember.findFirst({
    where: { userId, status: "ACTIVE" },
    include: { shop: true },
  });

  return member?.shop || null;
}

async function mustGetMyShop(userId) {
  const shop = await getMyShop(userId);
  if (!shop) throw httpError(404, "Bạn chưa có shop");
  if (shop.status === "PENDING") throw httpError(403, "Shop đang chờ duyệt");
  if (shop.status === "REJECTED") throw httpError(403, "Shop đã bị từ chối duyệt");
  if (shop.status === "SUSPENDED") throw httpError(403, "Shop đang bị tạm khoá");
  return shop;
}

// Restock order items (SKU stock + rollback soldCount). Use inside transactions.
async function restockOrderItems(tx, orderId) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: { skuId: true, qty: true, productId: true },
  });
  for (const it of items) {
    await tx.sKU.update({ where: { id: it.skuId }, data: { stock: { increment: it.qty } } });
    await tx.product.update({ where: { id: it.productId }, data: { soldCount: { decrement: it.qty } } });
  }
}

// --- Dashboard KPI ---
router.get(
  "/dashboard/kpi",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);

    // Revenue: sum of delivered orders (gross).
    const revenueAgg = await prisma.order.aggregate({
      where: { shopId: shop.id, status: { in: ["DELIVERED", "REFUNDED"] } },
      _sum: { total: true },
    });

    const [ordersCount, productsCount, stockAgg, finance] = await Promise.all([
      prisma.order.count({ where: { shopId: shop.id } }),
      // ProductStatus enum does not have DELETED; treat BANNED as removed from seller's active catalog.
      prisma.product.count({ where: { shopId: shop.id, status: { not: "BANNED" } } }),
      prisma.sKU.aggregate({
        where: { product: { shopId: shop.id }, status: { in: ["ACTIVE", "HIDDEN"] } },
        _sum: { stock: true },
      }),
      calcFinanceSummary(shop.id),
    ]);

    res.json({
      success: true,
      data: {
        revenue: revenueAgg?._sum?.total ?? 0,
        profit: finance?.profit ?? 0,
        orders: ordersCount,
        products: productsCount,
        stock: stockAgg?._sum?.stock ?? 0,
      },
    });
  })
);

router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    // Categories are shared with public catalog (seller uses for product CRUD)
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { children: true },
    });
    res.json({ success: true, data: categories });
  })
);

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

// Upload shop logo (multipart/form-data)
// field name: shopLogo
router.post(
  "/shop/logo",
  imageUpload.single("shopLogo"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw httpError(400, "Thiếu file logo");
    const shop = await mustGetMyShop(req.user.sub);
    const logoUrl = `/uploads/shops/${req.file.filename}`;
    const updated = await prisma.shop.update({ where: { id: shop.id }, data: { logoUrl } });
    res.json({ success: true, message: "Đã cập nhật logo shop", data: updated });
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

// --- Shipping config (shipping options) ---
function safeParseJson(jsonStr, fallback) {
  try {
    const v = JSON.parse(jsonStr);
    return v ?? fallback;
  } catch (e) {
    return fallback;
  }
}

const zoneSchema = z.object({
  province: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  district: z.string().min(1).max(100).optional(),
});

const shippingConfigSchema = z.object({
  carrier: z.string().min(2).max(50),
  code: z.string().min(2).max(64),
  serviceName: z.string().min(2).max(191),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),

  baseFee: z.number().int().nonnegative().optional(),
  feePerItem: z.number().int().nonnegative().optional(),
  feePerKg: z.number().int().nonnegative().optional(),
  freeShippingOver: z.number().int().nonnegative().optional().nullable(),

  minDays: z.number().int().nonnegative().optional(),
  maxDays: z.number().int().nonnegative().optional(),
  maxWeightGram: z.number().int().positive().optional().nullable(),
  codSupported: z.boolean().optional(),

  zones: z.array(zoneSchema).optional(),
});

// List shipping options
router.get(
  "/shipping-config",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    let list = await prisma.shippingConfig.findMany({
      where: { shopId: shop.id },
      orderBy: { id: "desc" },
    });

    // Ensure new shops have at least one shipping method to avoid checkout blockers.
    if (list.length === 0) {
      await prisma.shippingConfig.createMany({
        data: [
          {
            shopId: shop.id,
            carrier: "MockCarrier",
            code: "MOCK_STD",
            serviceName: "Giao tiêu chuẩn",
            description: "2–4 ngày (mặc định)",
            isActive: true,
            baseFee: 20000,
            feePerItem: 1000,
            feePerKg: 5000,
            freeShippingOver: null,
            minDays: 2,
            maxDays: 4,
            maxWeightGram: null,
            codSupported: true,
            zonesJson: null,
          },
          {
            shopId: shop.id,
            carrier: "MockCarrier",
            code: "MOCK_EXP",
            serviceName: "Giao nhanh",
            description: "1–2 ngày",
            isActive: true,
            baseFee: 35000,
            feePerItem: 1500,
            feePerKg: 8000,
            freeShippingOver: null,
            minDays: 1,
            maxDays: 2,
            maxWeightGram: null,
            codSupported: true,
            zonesJson: null,
          },
        ],
        skipDuplicates: true,
      });

      list = await prisma.shippingConfig.findMany({
        where: { shopId: shop.id },
        orderBy: { id: "desc" },
      });
    }

    const items = list.map((cfg) => ({
      ...cfg,
      zones: safeParseJson(cfg.zonesJson || "[]", []),
    }));

    res.json({ success: true, data: items });
  })
);

// Create shipping option
router.post(
  "/shipping-config",
  asyncHandler(async (req, res) => {
    const body = shippingConfigSchema.parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);

    const created = await prisma.shippingConfig.create({
      data: {
        shopId: shop.id,
        carrier: body.carrier,
        code: body.code,
        serviceName: body.serviceName,
        description: body.description || null,
        isActive: body.isActive ?? true,
        baseFee: body.baseFee ?? 0,
        feePerItem: body.feePerItem ?? 0,
        feePerKg: body.feePerKg ?? 0,
        freeShippingOver: body.freeShippingOver ?? null,
        minDays: body.minDays ?? 2,
        maxDays: body.maxDays ?? 4,
        maxWeightGram: body.maxWeightGram ?? null,
        codSupported: body.codSupported ?? true,
        zonesJson: body.zones ? JSON.stringify(body.zones) : null,
      },
    });

    res.status(201).json({ success: true, data: { ...created, zones: body.zones || [] } });
  })
);

// Update shipping option
router.put(
  "/shipping-config/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = shippingConfigSchema.partial().parse(req.body);
    const shop = await mustGetMyShop(req.user.sub);

    const cfg = await prisma.shippingConfig.findFirst({ where: { id, shopId: shop.id } });
    if (!cfg) throw httpError(404, "Không tìm thấy cấu hình");

    const updated = await prisma.shippingConfig.update({
      where: { id },
      data: {
        carrier: body.carrier ?? cfg.carrier,
        code: body.code ?? cfg.code,
        serviceName: body.serviceName ?? cfg.serviceName,
        description: body.description ?? cfg.description,
        isActive: body.isActive ?? cfg.isActive,
        baseFee: body.baseFee ?? cfg.baseFee,
        feePerItem: body.feePerItem ?? cfg.feePerItem,
        feePerKg: body.feePerKg ?? cfg.feePerKg,
        freeShippingOver: body.freeShippingOver === undefined ? cfg.freeShippingOver : body.freeShippingOver,
        minDays: body.minDays ?? cfg.minDays,
        maxDays: body.maxDays ?? cfg.maxDays,
        maxWeightGram: body.maxWeightGram === undefined ? cfg.maxWeightGram : body.maxWeightGram,
        codSupported: body.codSupported ?? cfg.codSupported,
        zonesJson: body.zones ? JSON.stringify(body.zones) : cfg.zonesJson,
      },
    });

    res.json({ success: true, data: { ...updated, zones: safeParseJson(updated.zonesJson || "[]", []) } });
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

// --- Excel import helpers ---
function buildImportTemplateBuffer(categories = []) {
  const headers = [
    "name*",
    "categorySlug",
    "price* (VND)",
    "compareAtPrice",
    "costPrice",
    "stock",
    "skuCode (optional for update)",
    "weightGram",
    "thumbnailUrl",
    "imageUrls (comma)",
    "description",
    "status (ACTIVE/HIDDEN/DRAFT)",
  ];

  const example = [
    "Bình đun siêu tốc 1.7L",
    "gia-dung",
    299000,
    349000,
    180000,
    50,
    "GD-KETTLE-001",
    1200,
    "https://example.com/thumb.jpg",
    "https://example.com/img1.jpg,https://example.com/img2.jpg",
    "Hàng gia dụng tiện lợi...",
    "ACTIVE",
  ];

  const wb = XLSX.utils.book_new();

  // Sheet: Products
  const wsProducts = XLSX.utils.aoa_to_sheet([headers, example]);
  wsProducts["!cols"] = headers.map((h) => ({ wch: Math.max(14, String(h).length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  // Sheet: Categories (for quick copy/paste of valid slugs)
  const catHeaders = ["slug", "name"];
  const catRows = (categories || []).map((c) => [c.slug, c.name]);
  const wsCats = XLSX.utils.aoa_to_sheet([catHeaders, ...catRows]);
  wsCats["!cols"] = [{ wch: 32 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsCats, "Categories");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

function parseIntSafe(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).toString().replace(/,/g, "").trim());
  if (Number.isNaN(n)) return null;
  return Math.floor(n);
}

// Download Excel import template
router.get(
  "/products/import-template",
  asyncHandler(async (req, res) => {
    const cats = await prisma.category.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } });
    const buf = buildImportTemplateBuffer(cats);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=product_import_template.xlsx");
    res.send(buf);
  })
);

// Import products via Excel (.xlsx)
// field name: file
router.post(
  "/products/import-excel",
  excelUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file || !req.file.buffer) throw httpError(400, "Thiếu file Excel");
    const shop = await mustGetMyShop(req.user.sub);
    const mode = String(req.query.mode || "upsert").toLowerCase(); // upsert | replace

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) throw httpError(400, "File Excel không hợp lệ");
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    if (!rows || rows.length < 2) {
      return res.json({ success: true, message: "Không có dòng dữ liệu", data: { created: 0, updated: 0, errors: [] } });
    }

    // Header mapping: accept reordered columns as long as headers exist.
    const headerRow = (rows[0] || []).map((v) => String(v || "").trim());
    const headerLower = headerRow.map((v) => v.toLowerCase());
    const hasHeader = headerLower.includes("name") || headerLower.includes("price") || headerLower.includes("categoryslug");

    function findCol(aliases) {
      for (const a of aliases) {
        const idx = headerLower.indexOf(String(a).toLowerCase());
        if (idx >= 0) return idx;
      }
      return -1;
    }

    const col = hasHeader
      ? {
          name: findCol(["name"]),
          categorySlug: findCol(["categoryslug", "category", "category slug"]),
          price: findCol(["price"]),
          compareAtPrice: findCol(["compareatprice", "compare at price"]),
          costPrice: findCol(["costprice", "cost price"]),
          stock: findCol(["stock"]),
          skuCode: findCol(["skucode", "sku code", "sku"]),
          weightGram: findCol(["weightgram", "weight gram"]),
          thumbnailUrl: findCol(["thumbnailurl", "thumbnail url", "thumbnail"]),
          imageUrls: findCol(["imageurls", "image urls", "images"]),
          description: findCol(["description"]),
          status: findCol(["status"]),
        }
      : null;

    if (hasHeader && (col.name < 0 || col.price < 0)) {
      throw httpError(400, "Thiếu cột bắt buộc trong file Excel: name và price");
    }

    // Prepare category map (slug/name => id)
    const cats = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
    const catBySlug = new Map(cats.map((c) => [String(c.slug || "").toLowerCase(), c.id]));
    const catByName = new Map(cats.map((c) => [String(c.name || "").toLowerCase(), c.id]));

    // Replace mode: hide all existing products of this shop first (soft replace).
    // This avoids "mất dữ liệu" (we do NOT delete). Imported rows will re-activate/update as needed.
    if (mode === "replace") {
      await prisma.product.updateMany({
        where: { shopId: shop.id },
        data: { status: "HIDDEN" },
      });
    }

    const errors = [];
    let created = 0;
    let updated = 0;
    const createdSkus = [];
    const updatedSkus = [];

    const startRow = hasHeader ? 1 : 0;
    for (let i = startRow; i < rows.length; i++) {
      const r = rows[i] || [];
      const rowNo = i + 1;
      const get = (key, fallbackIndex) => {
        if (col && col[key] >= 0) return r[col[key]];
        return r[fallbackIndex];
      };

      const name = String(get("name", 0) || "").trim();
      const categorySlug = String(get("categorySlug", 1) || "").trim();
      const price = parseIntSafe(get("price", 2));
      const compareAtPrice = parseIntSafe(get("compareAtPrice", 3));
      const costPrice = parseIntSafe(get("costPrice", 4));
      const stock = parseIntSafe(get("stock", 5)) ?? 0;
      const skuCode = String(get("skuCode", 6) || "").trim();
      const weightGram = parseIntSafe(get("weightGram", 7));
      const thumbnailUrl = String(get("thumbnailUrl", 8) || "").trim();
      const imageUrls = String(get("imageUrls", 9) || "").trim();
      const description = String(get("description", 10) || "").trim();
      const status = String(get("status", 11) || "").trim().toUpperCase();

      if (!name) {
        errors.push({ row: rowNo, message: "Thiếu name" });
        continue;
      }
      if (price == null || price < 0) {
        errors.push({ row: rowNo, message: "price không hợp lệ" });
        continue;
      }
      const finalStatus = ["ACTIVE", "HIDDEN", "DRAFT"].includes(status) ? status : "ACTIVE";

      let categoryId = null;
      if (categorySlug) {
        const key = categorySlug.toLowerCase();
        categoryId = catBySlug.get(key) || catByName.get(key) || null;
        // IMPORTANT: Category must already exist (created by admin).
        // Do NOT auto-create categories here to keep taxonomy consistent.
        if (!categoryId) {
          errors.push({
            row: rowNo,
            message: `Danh mục không tồn tại: "${categorySlug}". Vui lòng dùng slug trong sheet "Categories" của file mẫu.`,
          });
          continue;
        }
      }

      try {
        await prisma.$transaction(async (tx) => {
          // If skuCode exists in this shop => update
          let existingSku = null;
          if (skuCode) {
            existingSku = await tx.sKU.findFirst({
              where: { skuCode, product: { shopId: shop.id } },
              include: { product: true },
            });
          }

          if (existingSku) {
            await tx.product.update({
              where: { id: existingSku.productId },
              data: {
                name,
                description: description || null,
                categoryId,
                price,
                compareAtPrice: compareAtPrice || null,
                thumbnailUrl: thumbnailUrl || existingSku.product.thumbnailUrl || null,
                status: finalStatus,
              },
            });
            await tx.sKU.update({
              where: { id: existingSku.id },
              data: {
                stock,
                costPrice: costPrice == null ? undefined : costPrice,
                weightGram: weightGram == null ? undefined : weightGram,
              },
            });

            // Add images if provided
            if (imageUrls) {
              const list = imageUrls
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              for (const url of list) {
                if (!/^https?:\/\//i.test(url)) continue;
                await tx.productImage.create({ data: { productId: existingSku.productId, url } });
              }
            }

            updated++;
            updatedSkus.push(existingSku.id);
            return;
          }

          // Create new product + sku
          const baseSlug = slugify(name);
          let slug = baseSlug;
          const existsSlug = await tx.product.findUnique({ where: { slug } });
          if (existsSlug) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;

          const p = await tx.product.create({
            data: {
              shopId: shop.id,
              categoryId,
              name,
              slug,
              description: description || null,
              status: finalStatus,
              price,
              compareAtPrice: compareAtPrice || null,
              thumbnailUrl: thumbnailUrl || null,
            },
          });

          const code = skuCode || genSkuCode();
          const sku = await tx.sKU.create({
            data: {
              productId: p.id,
              skuCode: code,
              name: "Default",
              stock,
              costPrice: costPrice == null ? null : costPrice,
              weightGram: weightGram == null ? null : weightGram,
            },
          });

          // images
          if (imageUrls) {
            const list = imageUrls
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            for (const url of list) {
              if (!/^https?:\/\//i.test(url)) continue;
              await tx.productImage.create({ data: { productId: p.id, url } });
            }
            // if no thumbnailUrl provided, use first image as thumbnail
            if (!thumbnailUrl && list[0] && /^https?:\/\//i.test(list[0])) {
              await tx.product.update({ where: { id: p.id }, data: { thumbnailUrl: list[0] } });
            }
          }

          created++;
          createdSkus.push(sku.id);
        });
      } catch (e) {
        errors.push({ row: rowNo, message: e?.message || "Lỗi import" });
      }
    }

    res.json({
      success: true,
      message: `Import xong. Tạo mới ${created}, cập nhật ${updated}, lỗi ${errors.length}`,
      data: { created, updated, errors, createdSkus, updatedSkus },
    });
  })
);

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
          costPrice: Math.floor(Number(body.price || 0) * 0.6) || null,
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

// --- Product Images (URL-based) ---
const productImageSchema = z.object({
  url: z.string().url(),
  sortOrder: z.number().int().nonnegative().optional(),
});

router.get(
  "/products/:id/images",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    const images = await prisma.productImage.findMany({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
    res.json({ success: true, data: images });
  })
);

router.post(
  "/products/:id/images",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const shop = await mustGetMyShop(req.user.sub);
    const body = productImageSchema.parse(req.body);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    const created = await prisma.$transaction(async (tx) => {
      const img = await tx.productImage.create({
        data: {
          productId: id,
          url: body.url,
          sortOrder: body.sortOrder ?? 0,
        },
      });

      // Auto set thumbnail if missing
      if (!p.thumbnailUrl) {
        await tx.product.update({ where: { id }, data: { thumbnailUrl: body.url } });
      }
      return img;
    });

    res.status(201).json({ success: true, message: "Đã thêm ảnh", data: created });
  })
);

router.delete(
  "/products/:id/images/:imageId",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    const shop = await mustGetMyShop(req.user.sub);
    const p = await prisma.product.findFirst({ where: { id, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    await prisma.$transaction(async (tx) => {
      const img = await tx.productImage.findFirst({ where: { id: imageId, productId: id } });
      if (!img) throw httpError(404, "Không tìm thấy ảnh");

      await tx.productImage.delete({ where: { id: imageId } });

      if (p.thumbnailUrl && p.thumbnailUrl === img.url) {
        const next = await tx.productImage.findFirst({ where: { productId: id }, orderBy: { sortOrder: "asc" } });
        await tx.product.update({ where: { id }, data: { thumbnailUrl: next ? next.url : null } });
      }
    });

    res.json({ success: true, message: "Đã xoá ảnh" });
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
  costPrice: z.number().int().nonnegative().optional(),
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

// Compatibility endpoint (used by some frontend screens)
router.get(
  "/skus",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const productId = Number(req.query.productId);
    if (!productId || Number.isNaN(productId)) throw httpError(400, "productId là bắt buộc");

    const p = await prisma.product.findFirst({ where: { id: productId, shopId: shop.id } });
    if (!p) throw httpError(404, "Không tìm thấy sản phẩm");

    const skus = await prisma.sKU.findMany({ where: { productId }, orderBy: { id: "asc" } });
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
        costPrice: body.costPrice ?? null,
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
        costPrice: body.costPrice,
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
    const code = req.params.code;
    const body = z
      .object({
        carrier: z.string().min(2).max(50).optional(),
        trackingNo: z.string().min(3).max(64).optional(),
      })
      .parse(req.body);

    const shop = await mustGetMyShop(req.user.sub);
    const order = await prisma.order.findFirst({ where: { code, shopId: shop.id } });
    if (!order) throw httpError(404, "Không tìm thấy đơn");

    if (order.status !== "PACKING") throw httpError(400, "Đơn chưa ở trạng thái PACKING");

    const carrier = body.carrier || order.shippingCarrier || "MOCK";

    const shipment = await prisma.$transaction(async (tx) => {
      const created = await createShipment(order.id, carrier, body.trackingNo, tx);
      await tx.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
      return created;
    });

    await notify(order.userId, {
      type: "ORDER_SHIPPED",
      message: `Đơn ${order.code} đã được gửi đi`,
      data: { orderCode: order.code, trackingCode: shipment.trackingCode, carrier: shipment.carrier },
    });

    res.json({ success: true, data: shipment });
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
    if (order.status === "CANCELLED") throw httpError(400, "Đơn đã được huỷ");
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) throw httpError(400, "Không thể huỷ khi đã giao");
    // Cancel + restock (seller-initiated cancellation)
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await restockOrderItems(tx, order.id);
      return u;
    });
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

    // Cancellation refund policy:
    // - If the order was paid online, refund the paid amount (mock).
    // - If COD/unpaid, refundPayment will no-op.
    const amount = Number(order.total);
    const refund = await refundPayment(order.id, amount);
    await prisma.$transaction(async (tx) => {
      await tx.cancelRequest.update({ where: { id: order.cancelRequest.id }, data: { status: "APPROVED", resolvedById: req.user.sub, resolvedAt: new Date() } });
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await tx.refund.upsert({
        where: { orderId: order.id },
        update: { status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
        create: { orderId: order.id, amount, status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
      });
      // Restock because cancellation is finalized.
      await restockOrderItems(tx, order.id);
    });

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
      prisma.order.update({ where: { id: order.id }, data: { status: order.cancelRequest.originalStatus || "CONFIRMED" } }),
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
    // Optional policy fields: help sellers avoid losses for abusive returns.
    const body = z
      .object({
        resolution: z.enum(["BUYER_FAULT", "SELLER_FAULT"]).optional(),
        shippingPayer: z.enum(["BUYER", "SELLER"]).optional(),
        restockingFee: z.number().int().min(0).max(10_000_000).optional(),
        refundAmount: z.number().int().min(0).max(1_000_000_000).optional(),
        decisionNote: z.string().min(3).max(500).optional(),
      })
      .parse(req.body || {});

    await prisma.$transaction([
      prisma.returnRequest.update({
        where: { id: order.returnRequest.id },
        data: {
          status: "APPROVED",
          resolvedById: req.user.sub,
          resolvedAt: new Date(),
          resolution: body.resolution || order.returnRequest.resolution || null,
          shippingPayer: body.shippingPayer || order.returnRequest.shippingPayer || null,
          restockingFee: body.restockingFee ?? order.returnRequest.restockingFee ?? null,
          refundAmount: body.refundAmount ?? order.returnRequest.refundAmount ?? null,
          decisionNote: body.decisionNote || order.returnRequest.decisionNote || null,
        },
      }),
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
      prisma.returnRequest.update({
        where: { id: order.returnRequest.id },
        data: {
          status: "REJECTED",
          resolvedById: req.user.sub,
          resolvedAt: new Date(),
          decisionNote: body.reason || order.returnRequest.decisionNote || "Yêu cầu bị từ chối",
        },
      }),
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

    // Compute refund amount with optional seller protection policy.
    // - If seller set refundAmount => use it.
    // - Else refund = order.total - restockingFee (if any)
    const rr = order.returnRequest;
    const restockingFee = Number(rr.restockingFee || 0);
    let amount = rr.refundAmount != null ? Number(rr.refundAmount) : Number(order.total) - restockingFee;
    if (Number.isNaN(amount)) amount = Number(order.total);
    amount = Math.max(0, Math.min(Number(order.total), amount));

    const refund = await refundPayment(order.id, amount);

    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: order.returnRequest.id },
        data: {
          status: "RECEIVED",
          resolvedById: req.user.sub,
          resolvedAt: new Date(),
          refundAmount: rr.refundAmount != null ? rr.refundAmount : amount,
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "RETURN_RECEIVED" } });
      await tx.refund.upsert({
        where: { orderId: order.id },
        update: { status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
        create: { orderId: order.id, amount, status: refund.ok ? "SUCCESS" : "FAILED", providerRef: refund.ok ? refund.providerRef : null, processedById: req.user.sub },
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
    const reviews = await prisma.review.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, include: {
        user: { select: { id: true, username: true } },
        product: { select: { id: true, name: true } },
        replies: { include: { shop: { select: { id: true, name: true, slug: true } } } },
        buyerFollowUp: true,
        sellerFollowUp: true,
      } });
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

    // One reply per review per shop (upsert).
    // - If the shop already replied, update the content.
    // - Otherwise, create a new reply.
    const existing = await prisma.reviewReply.findUnique({ where: { reviewId_shopId: { reviewId: id, shopId: shop.id } } });
    if (!existing) {
      const created = await prisma.reviewReply.create({ data: { reviewId: id, shopId: shop.id, content: body.content } });
      return res.status(201).json({ success: true, message: "Đã phản hồi đánh giá", data: created });
    }
    if (Number(existing.editCount || 0) >= 1) {
      throw httpError(400, "Bạn chỉ được chỉnh sửa phản hồi 1 lần" );
    }
    const updated = await prisma.reviewReply.update({
      where: { id: existing.id },
      data: { content: body.content, editCount: { increment: 1 } },
    });
    return res.status(200).json({ success: true, message: "Đã cập nhật phản hồi", data: updated });
  })
);

// Seller follow-up after buyer follow-up (one per review)
router.post(
  "/reviews/:id/follow-up",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const reviewId = Number(req.params.id);
    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    const review = await prisma.review.findFirst({ where: { id: reviewId, shopId: shop.id } });
    if (!review) throw httpError(404, "Không tìm thấy review");
    const buyerFollowUp = await prisma.reviewBuyerFollowUp.findUnique({ where: { reviewId } });
    if (!buyerFollowUp) throw httpError(400, "Người mua chưa phản hồi thêm" );
    const existing = await prisma.reviewSellerFollowUp.findUnique({ where: { reviewId } });
    if (existing) throw httpError(409, "Bạn chỉ được phản hồi thêm 1 lần" );
    const created = await prisma.reviewSellerFollowUp.create({ data: { reviewId, shopId: shop.id, content: body.content } });
    res.status(201).json({ success: true, message: "Đã phản hồi thêm", data: created });
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



// --- Inventory ---
router.get(
  "/inventory",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const q = (req.query.q || "").toString().trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const where = {
      product: {
        shopId: shop.id,
        ...(q ? { name: { contains: q } } : {}),
      },
    };

    const [items, total] = await Promise.all([
      prisma.sKU.findMany({
        where,
        include: { product: true },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sKU.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const shaped = items.map((sku) => ({
      id: sku.id,
      code: sku.skuCode,
      name: sku.name,
      price: sku.price != null ? sku.price : sku.product?.price,
      costPrice: sku.costPrice ?? null,
      stock: sku.stock,
      status: sku.status,
      updatedAt: sku.updatedAt,
      product: sku.product
        ? { id: sku.product.id, name: sku.product.name, slug: sku.product.slug }
        : null,
    }));

    res.json({
      success: true,
      data: {
        items: shaped,
        pagination: { page, limit, total, totalPages },
      },
    });
  })
);

router.get(
  "/inventory/alerts",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const threshold = Math.max(0, Number(req.query.threshold || 5));

    const items = await prisma.sKU.findMany({
      where: {
        status: "ACTIVE",
        stock: { lte: threshold },
        product: { shopId: shop.id },
      },
      include: { product: true },
      orderBy: { stock: "asc" },
      take: 200,
    });

    res.json({ success: true, data: { threshold, items } });
  })
);

// --- Shop Vouchers ---
const shopVoucherSchema = z.object({
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
    const shop = await mustGetMyShop(req.user.sub);
    const list = await prisma.shopVoucher.findMany({
      where: { shopId: shop.id },
      orderBy: { id: "desc" },
    });
    res.json({ success: true, data: list });
  })
);

router.post(
  "/vouchers",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const body = shopVoucherSchema.parse(req.body);

    if (body.type === "PERCENT" && body.value > 100) throw httpError(400, "PERCENT tối đa 100");

    const created = await prisma.shopVoucher.create({
      data: {
        shopId: shop.id,
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

    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  "/vouchers/:id",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);
    const body = shopVoucherSchema.partial().parse(req.body);

    const existing = await prisma.shopVoucher.findFirst({ where: { id, shopId: shop.id } });
    if (!existing) throw httpError(404, "Không tìm thấy voucher");

    if (body.type === "PERCENT" && body.value != null && body.value > 100) throw httpError(400, "PERCENT tối đa 100");

    const updated = await prisma.shopVoucher.update({
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

    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/vouchers/:id",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);

    const existing = await prisma.shopVoucher.findFirst({ where: { id, shopId: shop.id } });
    if (!existing) throw httpError(404, "Không tìm thấy voucher");

    await prisma.shopVoucher.delete({ where: { id } });
    res.json({ success: true, message: "Đã xóa voucher" });
  })
);

// --- Shop Members (team) ---
// NOTE: simple permission model: only shop owner can manage members.
const memberCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(["MANAGER", "STAFF"]).default("STAFF"),
});

const memberUpdateSchema = z.object({
  role: z.enum(["MANAGER", "STAFF"]).optional(),
  status: z.enum(["ACTIVE", "INVITED", "DISABLED"]).optional(),
});

router.get(
  "/shop/members",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);

    const members = await prisma.shopMember.findMany({
      where: { shopId: shop.id },
      include: { user: { select: { id: true, email: true, name: true, role: true } } },
      orderBy: { id: "asc" },
    });

    res.json({ success: true, data: members });
  })
);

router.post(
  "/shop/members",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    if (shop.ownerId !== req.user.sub) throw httpError(403, "Chỉ chủ shop mới được quản lý thành viên");

    const body = memberCreateSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw httpError(404, "Không tìm thấy user theo email");

    if (user.id === shop.ownerId) throw httpError(400, "Chủ shop đã có quyền OWNER");

    const created = await prisma.shopMember.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        role: body.role,
        status: "ACTIVE",
      },
    });

    res.status(201).json({ success: true, data: created });
  })
);

router.put(
  "/shop/members/:id",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    if (shop.ownerId !== req.user.sub) throw httpError(403, "Chỉ chủ shop mới được quản lý thành viên");

    const id = Number(req.params.id);
    const body = memberUpdateSchema.parse(req.body);

    const existing = await prisma.shopMember.findFirst({ where: { id, shopId: shop.id } });
    if (!existing) throw httpError(404, "Không tìm thấy thành viên");

    if (existing.userId === shop.ownerId) throw httpError(400, "Không thể sửa quyền chủ shop");

    const updated = await prisma.shopMember.update({
      where: { id },
      data: {
        role: body.role ?? existing.role,
        status: body.status ?? existing.status,
      },
    });

    res.json({ success: true, data: updated });
  })
);

router.delete(
  "/shop/members/:id",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    if (shop.ownerId !== req.user.sub) throw httpError(403, "Chỉ chủ shop mới được quản lý thành viên");

    const id = Number(req.params.id);

    const existing = await prisma.shopMember.findFirst({ where: { id, shopId: shop.id } });
    if (!existing) throw httpError(404, "Không tìm thấy thành viên");
    if (existing.userId === shop.ownerId) throw httpError(400, "Không thể xóa chủ shop");

    await prisma.shopMember.delete({ where: { id } });
    res.json({ success: true, message: "Đã xóa thành viên" });
  })
);

// --- Finance / Payouts ---
const payoutRequestSchema = z.object({
  amount: z.number().int().positive().optional(),
  note: z.string().max(191).optional(),
});

async function calcFinanceSummary(shopId) {
  const [deliveredAgg, refundAgg, payoutReservedAgg, payoutPaidAgg, deliveredItems] = await Promise.all([
    prisma.order.aggregate({
      where: { shopId, status: "DELIVERED" },
      _sum: { subtotal: true, discount: true, total: true },
    }),
    prisma.refund.aggregate({
      where: { order: { shopId }, status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { shopId, status: { in: ["REQUESTED", "APPROVED"] } },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { shopId, status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { shopId, status: "DELIVERED" } },
      select: { qty: true, costPrice: true },
    }),
  ]);

  // Revenue = subtotal (exclude shipping). Discount is voucher/platform discounts.
  const grossMerchRevenue = deliveredAgg._sum.subtotal || 0;
  const voucherDiscount = deliveredAgg._sum.discount || 0;
  const grossRevenue = deliveredAgg._sum.total || 0; // backward compatible

  const refunds = refundAgg._sum.amount || 0;
  const reserved = payoutReservedAgg._sum.amount || 0;
  const paidOut = payoutPaidAgg._sum.amount || 0;

  const platformFee = Math.round(grossMerchRevenue * 0.15);
  const cogs = deliveredItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.costPrice || 0), 0);

  // Profit = merchandise revenue - cogs - platform fee - voucher discounts - refunds
  const profit = grossMerchRevenue - cogs - platformFee - voucherDiscount - refunds;

  // Net revenue (cash basis) keeps backward compatibility: total - refunds
  const netRevenue = Math.max(0, grossRevenue - refunds);
  const available = Math.max(0, netRevenue - reserved - paidOut);

  return {
    currency: "VND",
    // Backward compatible
    grossRevenue,
    refunds,
    netRevenue,
    reserved,
    paidOut,
    available,
    // New fields
    grossMerchRevenue,
    voucherDiscount,
    platformFee,
    cogs,
    profit,
  };
}

router.get(
  "/finance/summary",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const summary = await calcFinanceSummary(shop.id);
    res.json({ success: true, data: summary });
  })
);

router.get(
  "/finance/payouts",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const payouts = await prisma.payout.findMany({
      where: { shopId: shop.id },
      orderBy: { id: "desc" },
      take: 200,
    });
    res.json({ success: true, data: payouts });
  })
);

router.post(
  "/finance/payouts",
  withIdempotency(
    "PAYOUT_REQUEST",
    async (req) => {
      const shop = await mustGetMyShop(req.user.sub);
      const body = payoutRequestSchema.parse(req.body);

      const account = await prisma.payoutAccount.findUnique({ where: { shopId: shop.id } });
      if (!account) throw httpError(400, "Bạn cần cấu hình tài khoản nhận tiền trước");

      const summary = await calcFinanceSummary(shop.id);
      const amount = body.amount ?? summary.available;
      if (amount <= 0) throw httpError(400, "Số dư khả dụng = 0");
      if (amount > summary.available) throw httpError(400, "Số tiền yêu cầu vượt quá số dư khả dụng");

      const created = await prisma.payout.create({
        data: {
          shopId: shop.id,
          amount,
          currency: summary.currency,
          status: "REQUESTED",
          note: body.note || null,
          requestedById: req.user.sub,
        },
      });

      return { status: 201, body: { success: true, data: created } };
    },
    { requireKey: true, ttlSeconds: 60 * 60 * 24 }
  )
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


// --- Notifications (warnings from admin, etc.) ---
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

// --- Disputes (complaints from customer) ---
router.get(
  "/disputes",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const list = await prisma.dispute.findMany({
      where: { order: { shopId: shop.id } },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, username: true, name: true } },
        order: { select: { id: true, code: true, status: true, total: true, createdAt: true, deliveredAt: true } },
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

// Seller can request admin to revise a finalized dispute (only once)
const disputeRevisionSchema = z.object({
  note: z.string().trim().min(3).max(2000).optional(),
});

router.post(
  "/disputes/:id/request-revision",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);
    const body = disputeRevisionSchema.parse(req.body || {});

    const dispute = await prisma.dispute.findFirst({
      where: { id, order: { shopId: shop.id } },
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

    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "CS"] } },
      select: { id: true },
    });
    await Promise.all(
      (admins || []).map((a) =>
        notify(a.id, {
          type: "DISPUTE_REVISION_REQUEST",
          title: "Yêu cầu xem lại khiếu nại",
          body: `Đơn ${dispute.order.code} có yêu cầu xem lại từ shop`,
          data: { disputeId: id, orderCode: dispute.order.code },
        })
      )
    );

    res.json({ success: true, message: "Đã gửi yêu cầu xem lại", data: updated });
  })
);

// Seller respond to a dispute (1st line handling)
const disputeRespondSchema = z.object({
  message: z.string().trim().min(3).max(2000),
});

router.put(
  "/disputes/:id/respond",
  asyncHandler(async (req, res) => {
    const shop = await mustGetMyShop(req.user.sub);
    const id = Number(req.params.id);
    const body = disputeRespondSchema.parse(req.body);

    const dispute = await prisma.dispute.findFirst({
      where: { id, order: { shopId: shop.id } },
      include: {
        order: { select: { code: true } },
      },
    });
    if (!dispute) throw httpError(404, "Không tìm thấy khiếu nại");

    if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
      throw httpError(400, "Khiếu nại đã được xử lý, không thể phản hồi thêm.");
    }

    const updated = await prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        sellerResponse: body.message,
        sellerRespondedAt: new Date(),
        status: dispute.status === "OPEN" ? "UNDER_REVIEW" : dispute.status,
      },
    });

    // Notify customer
    await notify(dispute.userId, {
      type: "DISPUTE_UPDATE",
      title: "Shop đã phản hồi khiếu nại",
      body: `Đơn ${dispute.order?.code || ""}: ${body.message.slice(0, 120)}${body.message.length > 120 ? "…" : ""}`,
      data: { disputeId: dispute.id, orderCode: dispute.order?.code || null },
    });

    res.json({ success: true, message: "Đã gửi phản hồi", data: updated });
  })
);

module.exports = router;
