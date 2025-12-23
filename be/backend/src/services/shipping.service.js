const { prisma } = require("../lib/prisma");

function genTrackingCode(prefix = "TRK") {
  return `${prefix}${Date.now()}${Math.random().toString(16).slice(2, 6)}`.toUpperCase();
}

async function createShipment(orderId, carrier = "MOCK") {
  const trackingCode = genTrackingCode();

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier,
      trackingCode,
      status: "SHIPPED",
      shippedAt: new Date(),
    },
  });

  await prisma.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: "SHIPPED",
      message: "Đã bàn giao cho đơn vị vận chuyển",
    },
  });

  return shipment;
}

async function updateShipmentStatus(shipmentId, status, message) {
  const shipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
    },
  });

  await prisma.shipmentEvent.create({
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
