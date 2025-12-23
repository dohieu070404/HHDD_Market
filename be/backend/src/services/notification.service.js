const { prisma } = require("../lib/prisma");

/**
 * Demo notification service: chỉ ghi vào DB và console.log.
 * Thực tế: tích hợp Email/SMS/Push.
 */
async function notify(userId, { type, title, body, data }, db = prisma) {
  const rec = await db.notification.create({
    data: {
      userId,
      type,
      title,
      body: body || null,
      dataJson: data ? JSON.stringify(data) : null,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`[noti] user=${userId} type=${type} title=${title}`);
  return rec;
}

module.exports = { notify };
