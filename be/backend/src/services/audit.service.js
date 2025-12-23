const { prisma } = require("../lib/prisma");

async function audit(actorId, action, entityType, entityId, metadata) {
  return prisma.auditLog.create({
    data: {
      actorId: actorId || null,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

module.exports = { audit };
