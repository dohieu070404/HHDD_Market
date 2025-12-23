const { PrismaClient } = require("@prisma/client");

// PrismaClient nên là singleton để tránh tạo quá nhiều connection.
// Trong môi trường dev với hot-reload, pattern này giúp ổn định hơn.
let prisma;

function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

module.exports = {
  prisma: getPrisma(),
};
