const crypto = require("crypto");

const { prisma } = require("../lib/prisma");
const { httpError } = require("../utils/httpError");
const { asyncHandler } = require("../utils/asyncHandler");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sortKeysDeep(value[k]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function getIdempotencyKey(req) {
  const v = req.headers["idempotency-key"];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function computeRequestHash(req, userId) {
  const payload = {
    method: req.method,
    path: req.originalUrl,
    userId,
    body: req.body ?? null,
  };
  return sha256(stableStringify(payload));
}

/**
 * Idempotency wrapper.
 *
 * Usage:
 *   router.post("/endpoint", withIdempotency("SCOPE", async (req) => {
 *     return { status: 201, body: { success: true } };
 *   }, { requireKey: true }))
 */
function withIdempotency(scope, handler, { requireKey = true, ttlSeconds = 60 * 60 * 24 } = {}) {
  return asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) throw httpError(401, "Unauthorized");

    const key = getIdempotencyKey(req);
    if (requireKey && !key) throw httpError(400, "Thiếu header Idempotency-Key");

    // If idempotency key is not provided and not required, just execute handler.
    if (!key) {
      const result = await handler(req);
      return res.status(result.status || 200).json(result.body);
    }

    const requestHash = computeRequestHash(req, userId);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    let record;

    try {
      record = await prisma.idempotencyKey.create({
        data: {
          userId,
          scope,
          key,
          requestHash,
          status: "IN_PROGRESS",
          expiresAt,
        },
      });
    } catch (e) {
      // Unique key collision -> fetch existing
      if (e && e.code === "P2002") {
        const existing = await prisma.idempotencyKey.findUnique({
          where: { userId_scope_key: { userId, scope, key } },
        });

        if (!existing) throw e;
        if (existing.requestHash !== requestHash) {
          throw httpError(409, "Idempotency-Key đã dùng cho payload khác");
        }

        if (existing.status === "SUCCESS") {
          const payload = existing.responseJson ? JSON.parse(existing.responseJson) : null;
          return res
            .status(existing.httpStatus || 200)
            .set("X-Idempotent-Replay", "true")
            .json(payload);
        }

        if (existing.status === "FAILED") {
          const payload = existing.errorJson ? JSON.parse(existing.errorJson) : { message: "Request failed" };
          return res.status(existing.httpStatus || 409).json(payload);
        }

        // IN_PROGRESS
        throw httpError(409, "Request đang được xử lý (IN_PROGRESS)");
      }

      throw e;
    }

    try {
      const result = await handler(req);
      const httpStatus = result.status || 200;
      const body = result.body;

      await prisma.idempotencyKey.update({
        where: { id: record.id },
        data: {
          status: "SUCCESS",
          httpStatus,
          responseJson: JSON.stringify(body ?? null),
        },
      });

      return res.status(httpStatus).json(body);
    } catch (err) {
      // Best effort store error
      try {
        await prisma.idempotencyKey.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            httpStatus: err?.statusCode || 500,
            errorJson: JSON.stringify({
              success: false,
              message: err?.message || "Internal error",
            }),
          },
        });
      } catch (e) {
        // ignore secondary failure
      }
      throw err;
    }
  });
}

module.exports = { withIdempotency };
