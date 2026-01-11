const { prisma } = require("../lib/prisma");

function genProviderRef(prefix = "PAY") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Mock payment gateway.
 * - BANK_TRANSFER & MOCK_GATEWAY: auto capture ngay (demo).
 * - COD: UNPAID.
 */
async function createPaymentForOrder(orderId, method, amount, db = prisma) {
  const providerRef = genProviderRef();
  const now = new Date();

  let status = "UNPAID";
  let paidAt = null;

  if (method === "BANK_TRANSFER" || method === "MOCK_GATEWAY") {
    status = "CAPTURED";
    paidAt = now;
  }

  return db.payment.create({
    data: {
      orderId,
      method,
      status,
      amount,
      provider: method === "MOCK_GATEWAY" ? "MOCK" : null,
      providerRef,
      paidAt,
    },
  });
}

async function refundPayment(orderId, amount, db = prisma) {
  // Tìm payment CAPTURED gần nhất
  const payment = await db.payment.findFirst({
    where: { orderId, status: "CAPTURED" },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) {
    return { ok: false, message: "Không tìm thấy giao dịch đã thanh toán để hoàn" };
  }

  const ref = genProviderRef("REF");
  await db.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", providerRef: ref },
  });

  return { ok: true, providerRef: ref, paymentId: payment.id };
}

/**
 * COD in this demo is created as UNPAID at checkout.
 * In real marketplaces, COD is collected at delivery and should be considered "paid".
 *
 * This helper "captures" COD payment when the order is considered delivered.
 * It is safe to call multiple times (idempotent).
 */
async function captureCodPaymentIfNeeded(orderId, db = prisma) {
  // Most recent COD payment for this order
  const payment = await db.payment.findFirst({
    where: { orderId, method: "COD" },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return { ok: false, captured: false, message: "Không có giao dịch COD" };

  // Already paid/refunded
  if (payment.status === "CAPTURED" || payment.status === "REFUNDED") {
    return { ok: true, captured: false, paymentId: payment.id };
  }

  // Only auto-capture if it was still unpaid/authorized
  if (payment.status === "UNPAID" || payment.status === "AUTHORIZED") {
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: {
        status: "CAPTURED",
        paidAt: new Date(),
        // keep existing providerRef if any; otherwise generate a COD ref
        providerRef: payment.providerRef || genProviderRef("COD"),
      },
    });
    return { ok: true, captured: true, paymentId: updated.id };
  }

  return { ok: false, captured: false, paymentId: payment.id, message: `Trạng thái thanh toán không hợp lệ: ${payment.status}` };
}

module.exports = {
  createPaymentForOrder,
  refundPayment,
  captureCodPaymentIfNeeded,
};
