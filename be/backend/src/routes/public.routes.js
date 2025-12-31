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
    const [categories, featured] = await Promise.all([
      prisma.category.findMany({
        where: { parentId: null },
        orderBy: { name: "asc" },
        include: { children: true },
      }),
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { shop: { select: { id: true, name: true, slug: true } } },
      }),
    ]);

    res.json({ success: true, data: { categories, featured } });
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
          shop: { select: { id: true, name: true, slug: true } },
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
        shop: { select: { id: true, name: true, slug: true, ratingAvg: true, ratingCount: true } },
        category: { select: { id: true, name: true, slug: true } },
        images: true,
        skus: { where: { status: "ACTIVE" }, orderBy: { id: "asc" } },
        reviews: {
          where: { status: "VISIBLE" },
          include: { user: { select: { id: true, username: true, name: true } }, replies: true },
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
          replies: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
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
    if (!shop) return res.status(404).json({ success: false, message: "Không tìm thấy shop" });

    const products = await prisma.product.findMany({
      where: { shopId: shop.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    res.json({ success: true, data: { shop, products } });
  })
);

module.exports = router;
