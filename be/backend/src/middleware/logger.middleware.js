function logger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;

    // Don't spam logs for health checks
    if (req.path === "/health") return;

    const entry = {
      ts: new Date().toISOString(),
      level: "info",
      msg: "http_request",
      requestId: req.id || null,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: ms,
      ip: req.headers["x-forwarded-for"] || req.ip,
      userId: req.user?.sub || null,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  });

  next();
}

module.exports = { logger };
