// src/routes/auth.routes.js
const router = require("express").Router();
const {
  register,
  login,
  me,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  applySeller,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

// Account security
router.post("/change-password", requireAuth, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Seller apply (KYC pending)
router.post("/seller/apply", requireAuth, applySeller);

module.exports = router;
