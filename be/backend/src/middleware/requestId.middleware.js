const crypto = require("crypto");

function genRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Attach a request id to req.id and return it as X-Request-Id header.
 */
function requestId(req, res, next) {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.trim() ? incoming.trim() : genRequestId();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

module.exports = { requestId };
