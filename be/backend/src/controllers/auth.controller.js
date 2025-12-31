const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { prisma } = require("../lib/prisma");
const crypto = require("crypto");

const { slugify } = require("../utils/slugify");

const USER_ROLES = ["CUSTOMER", "SELLER", "ADMIN", "CS"];

function isStrongPassword(pw) {
    if (typeof pw !== "string") return false;
    // >= 8 chars, at least 1 lowercase, 1 uppercase, 1 number.
    // (Special char is recommended on frontend UX, but not enforced here.)
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pw);
}

const registerSchema = z
    .object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        username: z.string().min(3, "Username tối thiểu 3 ký tự"),
        email: z.string().email("Email không hợp lệ"),
        password: z
            .string()
            .min(8, "Mật khẩu tối thiểu 8 ký tự")
            .refine(isStrongPassword, "Mật khẩu nên có chữ hoa, chữ thường và số"),
    })
    .passthrough();

const loginSchema = z
    .object({
        username: z.string().min(1, "Thiếu username/email"),
        password: z.string().min(1, "Thiếu mật khẩu"),
    })
    .passthrough();

const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Thiếu mật khẩu cũ"),
    newPassword: z
        .string()
        .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
        .refine(isStrongPassword, "Mật khẩu mới nên có chữ hoa, chữ thường và số"),
});

const forgotPasswordSchema = z.object({
    email: z.string().email("Email không hợp lệ"),
});

const resetPasswordSchema = z.object({
    token: z.string().min(10, "Token không hợp lệ"),
    newPassword: z
        .string()
        .min(8, "Mật khẩu mới tối thiểu 8 ký tự")
        .refine(isStrongPassword, "Mật khẩu mới nên có chữ hoa, chữ thường và số"),
});

const applySellerSchema = z.object({
    shopName: z.string().min(2, "Tên shop tối thiểu 2 ký tự"),
    phone: z.string().min(6).optional(),
    taxId: z.string().min(3).optional(),
    kycDocumentUrl: z.string().url().optional(),
});

function signToken(user) {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    return jwt.sign(
        { sub: user.id, email: user.email, username: user.username || null, role: user.role },
        secret,
        { expiresIn }
    );
}

exports.register = async (req, res, next) => {
    try {
        const body = registerSchema.parse(req.body);

        // check trùng email hoặc username
        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ email: body.email }, { username: body.username }],
            },
            select: { id: true },
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "Email hoặc username đã tồn tại",
            });
        }

        const passwordHash = await bcrypt.hash(body.password, 10);
        const name = [body.firstName, body.lastName].filter(Boolean).join(" ") || null;

        const user = await prisma.user.create({
            data: {
                email: body.email,
                username: body.username,
                name,
                password: passwordHash,
                role: "CUSTOMER",
            },
            select: { id: true, email: true, username: true, name: true, role: true, createdAt: true },
        });

        return res.status(201).json({
            success: true,
            message: "Đăng ký thành công",
            data: user,
        });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: err.errors?.[0]?.message });
        }
        next(err);
    }
};

exports.login = async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const identifier = body.username.trim();

        const user = identifier.includes("@")
            ? await prisma.user.findUnique({ where: { email: identifier } })
            : await prisma.user.findUnique({ where: { username: identifier } });

        if (!user) {
            return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
        }

        if (user.isBlocked) {
            return res.status(403).json({ success: false, message: "Tài khoản đã bị khoá" });
        }

        const ok = await bcrypt.compare(body.password, user.password);
        if (!ok) {
            return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
        }

        const token = signToken(user);

        // return enriched user to make FE routing easier
        const [shop, sellerProfile] = await Promise.all([
            prisma.shop.findUnique({
                where: { ownerId: user.id },
                select: { id: true, name: true, slug: true, status: true },
            }),
            prisma.sellerProfile.findUnique({
                where: { userId: user.id },
                select: { id: true, status: true },
            }),
        ]);

        return res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    phone: user.phone,
                    avatarUrl: user.avatarUrl,
                    role: user.role,
                    shop,
                    sellerProfile,
                },
            },
        });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
        }
        next(err);
    }
};

exports.me = async (req, res, next) => {
    try {
        const userId = req.user.sub;

        const [user, shop, sellerProfile] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true, username: true, name: true, phone: true, avatarUrl: true, role: true, createdAt: true },
            }),
            prisma.shop.findUnique({
                where: { ownerId: userId },
                select: { id: true, name: true, slug: true, status: true },
            }),
            prisma.sellerProfile.findUnique({
                where: { userId },
                select: { userId: true, status: true, shopName: true, rejectedReason: true, createdAt: true },
            }),
        ]);

        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy user" });
        }

        return res.json({ success: true, data: { ...user, shop, sellerProfile } });
    } catch (err) {
        next(err);
    }
};

exports.logout = async (req, res) => {
    // JWT stateless: FE chỉ cần xoá token
    return res.json({ success: true });
};

exports.changePassword = async (req, res, next) => {
    try {
        const userId = req.user.sub;
        const body = changePasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ success: false, message: "Không tìm thấy user" });

        const ok = await bcrypt.compare(body.oldPassword, user.password);
        if (!ok) return res.status(400).json({ success: false, message: "Mật khẩu cũ không đúng" });

        const passwordHash = await bcrypt.hash(body.newPassword, 10);
        await prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });

        return res.json({ success: true, message: "Đổi mật khẩu thành công" });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: err.errors?.[0]?.message });
        }
        next(err);
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const body = forgotPasswordSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email: body.email } });

        // Trả về success cho cả trường hợp không có user để tránh lộ thông tin.
        if (!user) return res.json({ success: true, message: "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn." });

        const token = crypto.randomBytes(24).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                token,
                expiresAt,
            },
        });

        // Demo: trả token nếu không phải production
        const isProd = process.env.NODE_ENV === "production";

        return res.json({
            success: true,
            message: "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn.",
            data: isProd ? undefined : { token, expiresAt },
        });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: err.errors?.[0]?.message });
        }
        next(err);
    }
};

exports.resetPassword = async (req, res, next) => {
    try {
        const body = resetPasswordSchema.parse(req.body);

        const record = await prisma.passwordResetToken.findUnique({ where: { token: body.token } });
        if (!record) return res.status(400).json({ success: false, message: "Token không hợp lệ" });

        if (record.usedAt) return res.status(400).json({ success: false, message: "Token đã được dùng" });
        if (record.expiresAt.getTime() < Date.now())
            return res.status(400).json({ success: false, message: "Token đã hết hạn" });

        const passwordHash = await bcrypt.hash(body.newPassword, 10);
        await prisma.$transaction([
            prisma.user.update({ where: { id: record.userId }, data: { password: passwordHash } }),
            prisma.passwordResetToken.update({ where: { token: body.token }, data: { usedAt: new Date() } }),
        ]);

        return res.json({ success: true, message: "Đặt lại mật khẩu thành công" });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: err.errors?.[0]?.message });
        }
        next(err);
    }
};

exports.applySeller = async (req, res, next) => {
    try {
        const userId = req.user.sub;
        const body = applySellerSchema.parse(req.body);

        // Generate shop slug (unique)
        const baseSlug = slugify(body.shopName);
        let slug = baseSlug;
        const slugExists = await prisma.shop.findFirst({
            where: { slug, NOT: { ownerId: userId } },
        });
        if (slugExists) slug = `${baseSlug}-${Math.random().toString(16).slice(2, 6)}`;

        const existing = await prisma.sellerProfile.findUnique({ where: { userId } });

        // Re-apply when previously rejected
        if (existing && existing.status === "REJECTED") {
            const shop = await prisma.shop.findUnique({ where: { ownerId: userId } });

            const [sellerProfile, upsertedShop] = await prisma.$transaction([
                prisma.sellerProfile.update({
                    where: { userId },
                    data: {
                        status: "PENDING",
                        shopName: body.shopName,
                        phone: body.phone,
                        taxId: body.taxId,
                        kycDocumentUrl: body.kycDocumentUrl,
                        rejectedReason: null,
                    },
                }),
                shop
                    ? prisma.shop.update({
                          where: { id: shop.id },
                          data: { name: body.shopName, slug, status: "PENDING" },
                      })
                    : prisma.shop.create({
                          data: { ownerId: userId, name: body.shopName, slug, status: "PENDING" },
                      }),
            ]);

            return res.status(201).json({
                success: true,
                message: "Đã gửi lại yêu cầu mở shop. Vui lòng chờ duyệt.",
                data: { sellerProfile, shop: upsertedShop },
            });
        }

        // Already applied / approved
        if (existing) {
            return res.status(409).json({
                success: false,
                message:
                    existing.status === "APPROVED"
                        ? "Bạn đã là người bán (Seller)."
                        : "Bạn đã có hồ sơ Seller. Vui lòng chờ duyệt.",
                data: existing,
            });
        }

        // Create new profile + shop
        const [sellerProfile, shop] = await prisma.$transaction([
            prisma.sellerProfile.create({
                data: {
                    userId,
                    status: "PENDING",
                    shopName: body.shopName,
                    phone: body.phone,
                    taxId: body.taxId,
                    kycDocumentUrl: body.kycDocumentUrl,
                },
            }),
            prisma.shop.create({
                data: {
                    ownerId: userId,
                    name: body.shopName,
                    slug,
                    status: "PENDING",
                },
            }),
        ]);

        return res.status(201).json({
            success: true,
            message: "Đã gửi yêu cầu mở shop. Vui lòng chờ duyệt.",
            data: { sellerProfile, shop },
        });
    } catch (err) {
        if (err.name === "ZodError") {
            return res.status(400).json({ success: false, message: err.errors?.[0]?.message });
        }
        next(err);
    }
};

