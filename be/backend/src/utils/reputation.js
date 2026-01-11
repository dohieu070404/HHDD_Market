const REPUTATION_MIN = 0;
const REPUTATION_MAX = 100;

/**
 * Clamp score to [0..100] and round to 1 decimal for 0.1 / 0.5 increments.
 */
function clampScore(v) {
  const n = Number(v || 0);
  const rounded = Math.round(n * 10) / 10;
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, rounded));
}

function getReputationTitle(score) {
  const s = Number(score || 0);
  if (s >= 90) return "Shop Kim Cương";
  if (s >= 80) return "Shop Vàng";
  if (s >= 60) return "Shop Bạc";
  if (s >= 40) return "Shop Đồng";
  if (s >= 20) return "Shop nguy cơ";
  return "Shop tín nhiệm thấp";
}

function getPenaltyPointsBySeverity(severity) {
  const map = {
    LEVEL_1: 0.5,
    LEVEL_2: 1,
    LEVEL_3: 1.5,
    LEVEL_4: 2,
  };
  return map[severity] ?? 0.5;
}

/**
 * Apply a reputation delta to a shop, clamped to [0..100], and log it.
 * Must be called inside a Prisma transaction for consistency.
 */
async function applyShopReputationDelta(tx, shopId, delta, meta = {}) {
  const shop = await tx.shop.findUnique({
    where: { id: shopId },
    select: { id: true, reputationScore: true },
  });
  if (!shop) return null;

  const before = Number(shop.reputationScore ?? 40);
  const after = clampScore(before + Number(delta || 0));

  // If score doesn't change, we still log only when explicitly requested.
  const shouldLog = meta.forceLog || after !== before;

  await tx.shop.update({
    where: { id: shopId },
    data: { reputationScore: after, reputationUpdatedAt: new Date() },
  });

  if (shouldLog) {
    await tx.shopReputationEvent.create({
      data: {
        shopId,
        delta: Number(delta || 0),
        beforeScore: before,
        afterScore: after,
        source: meta.source || null,
        refType: meta.refType || null,
        refId: meta.refId != null ? Number(meta.refId) : null,
        note: meta.note || null,
        actorId: meta.actorId != null ? Number(meta.actorId) : null,
      },
    });
  }

  return { before, after };
}

module.exports = {
  REPUTATION_MIN,
  REPUTATION_MAX,
  clampScore,
  getReputationTitle,
  getPenaltyPointsBySeverity,
  applyShopReputationDelta,
};
