const path = require("path");
const multer = require("multer");
const fs = require("fs");

function safeExt(mimetype) {
  if (!mimetype) return ".bin";
  if (mimetype === "image/jpeg" || mimetype === "image/jpg") return ".jpg";
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/gif") return ".gif";
  if (mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return ".xlsx";
  if (mimetype === "application/vnd.ms-excel") return ".xls";
  return ".bin";
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const uploadsDir = path.join(__dirname, "..", "..", "uploads");

// Disk storage for images (avatars, shop logos, review/dispute evidences)
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderMap = {
      avatar: "avatars",
      shopLogo: "shops",
      reviewImages: "reviews",
      disputeImages: "disputes",
    };
    const folder = folderMap[file.fieldname] || "avatars";
    const dir = path.join(uploadsDir, folder);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // ignore
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = safeExt(file.mimetype);
    const base = `${file.fieldname}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    cb(null, `${base}${ext}`);
  },
});

function imageFileFilter(req, file, cb) {
  // NOTE:
  // - Một số browser có thể gửi "image/jpg" thay vì "image/jpeg"
  // - Với demo, chỉ allow các định dạng phổ biến để tránh upload file lạ.
  const ok = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
  if (!ok) return cb(badRequest("Chỉ cho phép upload ảnh (jpg/png/webp/gif)"));
  cb(null, true);
}

// Memory storage for Excel import
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Một số browser (hoặc reverse proxy) có thể gửi application/octet-stream.
    // Vì vậy ta allow theo mimetype + extension.
    const okMime = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/octet-stream",
    ].includes(file.mimetype);
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const okExt = [".xlsx", ".xls"].includes(ext);
    const ok = okMime && okExt;
    if (!ok) return cb(badRequest("Chỉ cho phép upload file Excel (.xlsx/.xls)"));
    cb(null, true);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

module.exports = {
  imageUpload,
  excelUpload,
};
