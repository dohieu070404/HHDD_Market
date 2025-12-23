const { prisma } = require("../lib/prisma");

/**
 * Recalculate rating metrics for a product based on visible reviews.
 *
 * @param {number} productId
 * @param {import('@prisma/client').PrismaClient} [tx]
 */
async function recalcProductRating(productId, tx = prisma) {
  if (!productId) return;

  const agg = await tx.review.aggregate({
    where: { productId, status: "VISIBLE" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const avg = agg?._avg?.rating ?? 0;
  const count = agg?._count?.rating ?? 0;

  await tx.product.update({
    where: { id: productId },
    data: {
      ratingAvg: avg,
      ratingCount: count,
    },
  });
}

/**
 * Recalculate rating metrics for a shop based on visible reviews.
 *
 * @param {number} shopId
 * @param {import('@prisma/client').PrismaClient} [tx]
 */
async function recalcShopRating(shopId, tx = prisma) {
  if (!shopId) return;

  const agg = await tx.review.aggregate({
    where: { shopId, status: "VISIBLE" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const avg = agg?._avg?.rating ?? 0;
  const count = agg?._count?.rating ?? 0;

  await tx.shop.update({
    where: { id: shopId },
    data: {
      ratingAvg: avg,
      ratingCount: count,
    },
  });
}

module.exports = {
  recalcProductRating,
  recalcShopRating,
};
