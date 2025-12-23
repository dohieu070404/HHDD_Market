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

module.exports = {
  createPaymentForOrder,
  refundPayment,
};
