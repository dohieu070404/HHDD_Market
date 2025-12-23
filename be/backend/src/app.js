// src/app.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const publicRoutes = require("./routes/public.routes");
const customerRoutes = require("./routes/customer.routes");
const sellerRoutes = require("./routes/seller.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
}));
app.use(express.json());

app.use(
    rateLimit({
        windowMs: 60 * 1000,
        limit: 120,
    })
);

app.get("/health", (req, res) => res.json({ ok: true }));

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

app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || "Internal Server Error",
        details: err.details || undefined,
    });
});

module.exports = app;
