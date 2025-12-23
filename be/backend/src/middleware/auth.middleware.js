const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

/**
 * Require authentication (JWT) and attach req.user.
 * - Reject blocked accounts.
 * - Load latest role from DB (tránh token cũ nếu admin đổi role).
 */
exports.requireAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Thiếu token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true, isBlocked: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "Token không hợp lệ" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khoá" });
    }

    req.user = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token không hợp lệ hoặc hết hạn" });
  }
};

/**
 * Require one of roles.
 * @param  {...string} roles e.g. "ADMIN", "CS", "SELLER", "CUSTOMER"
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Không có quyền truy cập" });
    }
    next();
  };
};
