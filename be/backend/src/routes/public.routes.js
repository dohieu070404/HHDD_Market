const router = require("express").Router();

const { prisma } = require("../lib/prisma");
const { asyncHandler } = require("../utils/asyncHandler");

async function collectCategoryIds(rootId) {
  const ids = [rootId];
  let frontier = [rootId];
  // Avoid infinite loops just in case
  for (let depth = 0; depth < 4; depth++) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    ids.push(...childIds);
    frontier = childIds;
  }
  return Array.from(new Set(ids));
}

// --- Home ---
router.get(
  "/home",
  asyncHandler(async (req, res) => {
    const [categories, featured, flashSale, topShops] = await Promise.all([
      prisma.category.findMany({
        where: { parentId: null },
        orderBy: { name: "asc" },
        include: { children: true },
      }),
      // "Gợi ý hôm nay": score = f(lượt mua, sao, số lượt đánh giá) để giảm seeding
      (async () => {
        // Global mean (rough) used for Bayesian rating
        const avgAgg = await prisma.product.aggregate({
          where: { status: "ACTIVE", shop: { status: "ACTIVE" }, ratingCount: { gt: 0 } },
          _avg: { ratingAvg: true },
        });
        const C = Number(avgAgg?._avg?.ratingAvg || 0);
        const m = 10; // prior weight (10 ratings)

        // Pull a wider candidate set first, then rank in JS
        const candidates = await prisma.product.findMany({
          where: { status: "ACTIVE", shop: { status: "ACTIVE" } },
          orderBy: [{ soldCount: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
          take: 120,
          include: { shop: { select: { id: true, name: true, slug: true, logoUrl: true } } },
        });

        const scored = (candidates || [])
          .map((p) => {
            const sold = Number(p.soldCount || 0);
            const rc = Number(p.ratingCount || 0);
            const ra = Number(p.ratingAvg || 0);
            const bayes = (rc * ra + m * C) / (rc + m);
            // weight purchase signals higher than pure stars, and add small bonus for more ratings
            const score = Math.log1p(sold) * 1.25 + bayes * 1.0 + Math.log1p(rc) * 0.15;
            return { p, score };
          })
          .sort((a, b) => b.score - a.score || (b.p.soldCount || 0) - (a.p.soldCount || 0))
          .slice(0, 8)
          .map((x) => x.p);

        return scored;
      })(),
      // Flash sale: sản phẩm có giá giảm (compareAtPrice > price)
      prisma.product.findMany({
        where: {
          status: "ACTIVE",
          shop: { status: "ACTIVE" },
          compareAtPrice: { not: null },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
        include: { shop: { select: { id: true, name: true, slug: true, logoUrl: true } } },
      }).then((items) =>
        (items || [])
          .filter((p) => (p.compareAtPrice || 0) > (p.price || 0))
          .map((p) => ({
            ...p,
            discount: (p.compareAtPrice || 0) - (p.price || 0),
          }))
          .sort((a, b) => (b.discount || 0) - (a.discount || 0) || (b.soldCount || 0) - (a.soldCount || 0))
          .slice(0, 8)
      ),
      // Top shops: ưu tiên shop có rating tốt
      prisma.shop.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          ratingAvg: true,
          ratingCount: true,
        },
      }),
    ]);

    res.json({ success: true, data: { categories, featured, flashSale, topShops } });
  })
);

// --- Categories ---
router.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { children: true },
    });
    res.json({ success: true, data: categories });
  })
);

// --- Products list / search ---
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const categorySlug = (req.query.category || "").toString().trim();
    const shopSlug = (req.query.shop || "").toString().trim();
    const sort = (req.query.sort || "new").toString();
    const minPrice = req.query.minPrice != null ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice != null ? Number(req.query.maxPrice) : null;
    const minRating = req.query.minRating != null ? Number(req.query.minRating) : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
    const skip = (page - 1) * limit;

    const where = {
      status: "ACTIVE",
      shop: { status: "ACTIVE" },
    };

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { description: { contains: q } },
      ];
    }

    if (categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: categorySlug } });
      if (cat) {
        const ids = await collectCategoryIds(cat.id);
        where.categoryId = { in: ids };
      }
    }

    if (!Number.isNaN(minPrice) && minPrice != null) {
      where.price = { ...(where.price || {}), gte: minPrice };
    }
    if (!Number.isNaN(maxPrice) && maxPrice != null) {
      where.price = { ...(where.price || {}), lte: maxPrice };
    }

    if (!Number.isNaN(minRating) && minRating != null) {
      where.ratingAvg = { gte: minRating };
    }

    if (shopSlug) {
      const shop = await prisma.shop.findUnique({ where: { slug: shopSlug } });
      if (shop) where.shopId = shop.id;
    }

    // Multi-column sort (Shopee-like)
    let orderBy = [{ createdAt: "desc" }];
    if (sort === "price_asc") orderBy = [{ price: "asc" }, { createdAt: "desc" }];
    if (sort === "price_desc") orderBy = [{ price: "desc" }, { createdAt: "desc" }];
    if (sort === "rating_desc") orderBy = [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }];
    if (sort === "sold_desc") orderBy = [{ soldCount: "desc" }, { createdAt: "desc" }];
    if (sort === "name_asc") orderBy = [{ name: "asc" }];
    if (sort === "name_desc") orderBy = [{ name: "desc" }];

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
          _count: { select: { reviews: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  })
);

// --- Product detail ---
router.get(
  "/products/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const product = await prisma.product.findFirst({
      where: { slug, status: "ACTIVE", shop: { status: "ACTIVE" } },
      include: {
        shop: { select: { id: true, name: true, slug: true, logoUrl: true, ratingAvg: true, ratingCount: true } },
        category: { select: { id: true, name: true, slug: true } },
        images: true,
        skus: { where: { status: "ACTIVE" }, orderBy: { id: "asc" } },
        reviews: {
          where: { status: "VISIBLE" },
          include: {
            user: { select: { id: true, username: true, name: true } },
            replies: { include: { shop: { select: { id: true, name: true, slug: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!product || product.status !== "ACTIVE") {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    res.json({ success: true, data: product });
  })
);

// Similar products (name similarity > same category > popular)
router.get(
  "/products/:slug/similar",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const limit = Math.min(24, Math.max(1, Number(req.query.limit || 8)));

    const base = await prisma.product.findFirst({
      where: { slug, status: "ACTIVE", shop: { status: "ACTIVE" } },
      select: { id: true, name: true, categoryId: true },
    });

    if (!base) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }

    const rawTokens = String(base.name || "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);

    const stop = new Set(["va", "và", "cho", "của", "the", "and", "with", "set", "combo"]);
    const tokens = Array.from(new Set(rawTokens.filter((t) => t.length >= 3 && !stop.has(t)))).slice(0, 5);

    const orderBy = [{ soldCount: "desc" }, { ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }];
    const include = { shop: { select: { id: true, name: true, slug: true, logoUrl: true } } };

    const results = [];
    const seen = new Set([base.id]);

    const pushUnique = (list) => {
      for (const p of list || []) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        results.push(p);
        if (results.length >= limit) break;
      }
    };

    if (tokens.length) {
      const nameMatches = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          shop: { status: "ACTIVE" },
          id: { not: base.id },
          OR: tokens.map((t) => ({ name: { contains: t, mode: "insensitive" } })),
        },
        orderBy,
        take: limit * 3,
        include,
      });
      pushUnique(nameMatches);
    }

    if (results.length < limit && base.categoryId) {
      const catMatches = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          shop: { status: "ACTIVE" },
          id: { notIn: Array.from(seen) },
          categoryId: base.categoryId,
        },
        orderBy,
        take: limit * 3,
        include,
      });
      pushUnique(catMatches);
    }

    if (results.length < limit) {
      const more = await prisma.product.findMany({
        where: { status: "ACTIVE", shop: { status: "ACTIVE" }, id: { notIn: Array.from(seen) } },
        orderBy,
        take: limit,
        include,
      });
      pushUnique(more);
    }

    res.json({ success: true, data: results.slice(0, limit) });
  })
);

// Reviews of a product (pagination)
router.get(
  "/products/:productId/reviews",
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    if (!productId) {
      return res.status(400).json({ success: false, message: "productId không hợp lệ" });
    }

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    const where = { productId, status: "VISIBLE" };
    const [total, items] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, name: true } },
          replies: { include: { shop: { select: { id: true, name: true, slug: true } } } },
          buyerFollowUp: true,
          sellerFollowUp: true,
        },
      }),
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

    res.json({
      success: true,
      data: { items: withMedia, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  })
);

// --- Shop detail ---
router.get(
  "/shops/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const shop = await prisma.shop.findUnique({
      where: { slug },
      include: {
        shopAddresses: true,
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!shop || shop.status !== "ACTIVE") {
      return res.status(404).json({ success: false, message: "Không tìm thấy shop" });
    }

    
const products = await prisma.product.findMany({
  where: { shopId: shop.id, status: "ACTIVE" },
  select: { id: true, ratingAvg: true, ratingCount: true },
});

const ratingCount = products.reduce((acc, p) => acc + (p.ratingCount || 0), 0);
const ratingSum = products.reduce((acc, p) => acc + (Number(p.ratingAvg || 0) * (p.ratingCount || 0)), 0);
const ratingAvg = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

const now = new Date();
const shopVouchers = await prisma.shopVoucher.findMany({
  where: {
    shopId: shop.id,
    isActive: true,
    OR: [{ startAt: null }, { startAt: { lte: now } }],
    AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
  },
  orderBy: { createdAt: "desc" },
  take: 10,
  select: {
    id: true,
    code: true,
    type: true,
    value: true,
    minSubtotal: true,
    maxDiscount: true,
    startAt: true,
    endAt: true,
    usageLimit: true,
    usedCount: true,
  },
});

const latestProducts = await prisma.product.findMany({
  where: { shopId: shop.id, status: "ACTIVE" },
  orderBy: { createdAt: "desc" },
  take: 12,
});

// Categories available in this shop (based on active products)
const grouped = await prisma.product.groupBy({
  by: ["categoryId"],
  where: {
    shopId: shop.id,
    status: "ACTIVE",
    categoryId: { not: null },
  },
  _count: { _all: true },
});

const categoryIds = grouped.map((g) => g.categoryId).filter(Boolean);
const cats = categoryIds.length
  ? await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, slug: true, parentId: true },
    })
  : [];

const categories = grouped
  .map((g) => {
    const c = cats.find((x) => x.id === g.categoryId);
    if (!c) return null;
    return {
      ...c,
      productCount: g._count._all,
    };
  })
  .filter(Boolean)
  .sort((a, b) => (b.productCount || 0) - (a.productCount || 0) || a.name.localeCompare(b.name));

res.json({
  success: true,
  data: {
    shop,
    stats: { ratingAvg, ratingCount },
    vouchers: shopVouchers,
    categories,
    products: latestProducts,
  },
});

  })
);

module.exports = router;
