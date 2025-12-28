const { prisma } = require("../lib/prisma");

function genTrackingCode(prefix = "TRK") {
  return `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

/**
 * Create a shipment record for an order.
 * - carrier: string identifier (e.g. GHN, GHTK, J&T, MOCK)
 * - trackingCode: optional; if omitted, a random mock code will be generated
 */
async function createShipment(orderId, carrier = "MOCK", trackingCode = null, db = prisma) {
  const tracking = (trackingCode && trackingCode.toString().trim()) || genTrackingCode();

  const shipment = await db.shipment.create({
    data: {
      orderId,
      carrier,
      trackingCode: tracking,
      status: "SHIPPED",
      shippedAt: new Date(),
    },
  });

  await db.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: "SHIPPED",
      message: "Đã bàn giao cho đơn vị vận chuyển",
    },
  });

  return shipment;
}

async function updateShipmentStatus(shipmentId, status, message, db = prisma) {
  const shipment = await db.shipment.update({
    where: { id: shipmentId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
    },
  });

  await db.shipmentEvent.create({
    data: {
      shipmentId,
      status,
      message: message || null,
    },
  });

  return shipment;
}

module.exports = {
  createShipment,
  updateShipmentStatus,
};
