// src/app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { requestId } = require("./middleware/requestId.middleware");
const { logger } = require("./middleware/logger.middleware");

const authRoutes = require("./routes/auth.routes");
const publicRoutes = require("./routes/public.routes");
const customerRoutes = require("./routes/customer.routes");
const sellerRoutes = require("./routes/seller.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

// If you run behind a reverse proxy (nginx/traefik), this helps Express resolve client IP correctly.
app.set("trust proxy", 1);

app.use(requestId);
app.use(logger);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Static uploads (avatars, shop logos, etc.)
// Use relative URLs like /uploads/avatars/xxx.png
try {
  const uploadsDir = path.join(__dirname, "..", "uploads");
  fs.mkdirSync(path.join(uploadsDir, "avatars"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "shops"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "reviews"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "disputes"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "tmp"), { recursive: true });
  app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));
} catch {
  // ignore
}

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
  })
);

app.get("/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString(), requestId: req.id }));

// Giữ /auth cho tương thích cũ
app.use("/auth", authRoutes);

// Thêm /api/auth để khớp FE đang gọi /api/auth/*
app.use("/api/auth", authRoutes);

// Public browsing API
app.use("/api/public", publicRoutes);

// Customer / Buyer API
app.use("/api/customer", customerRoutes);

// Seller Center API
app.use("/api/seller", sellerRoutes);

// Admin Console API
app.use("/api/admin", adminRoutes);

// Central error handler
app.use((err, req, res, next) => {
<<<<<<< HEAD
    console.error(err);

    // JSON parse error (body-parser)
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "JSON không hợp lệ" });
    }

    // Zod validation errors
    if (err && (err.name === "ZodError" || err.issues)) {
        const issues = err.issues || [];
        return res.status(400).json({
            success: false,
            message: "Dữ liệu không hợp lệ",
            details: issues.map((i) => ({
                path: i.path,
                message: i.message,
            })),
        });
    }

    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || "Lỗi hệ thống",
        details: err.details || undefined,
=======
  const safe = {
    ts: new Date().toISOString(),
    level: "error",
    msg: "error",
    requestId: req.id || null,
    path: req.originalUrl,
    method: req.method,
    status: err?.status || 500,
    code: err?.code || null,
    message: err?.message || "Unhandled error",
  };

  // eslint-disable-next-line no-console
  console.error(JSON.stringify(safe));

  // JSON parse error (body-parser)
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "JSON không hợp lệ" });
  }

  // Multer errors (file upload)
  if (err && (err instanceof multer.MulterError || err?.code === "LIMIT_FILE_SIZE")) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File quá lớn" : (err.message || "Upload thất bại");
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ success: false, message: msg, requestId: req.id || undefined });
  }

  // Zod validation errors
  if (err && (err.name === "ZodError" || err.issues)) {
    const issues = err.issues || [];
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      details: issues.map((i) => ({
        path: i.path,
        message: i.message,
      })),
>>>>>>> cf58fbf676831dda94e320c756cb5efb3f44fada
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Lỗi hệ thống",
    details: err.details || undefined,
    requestId: req.id || undefined,
  });
});

module.exports = app;
