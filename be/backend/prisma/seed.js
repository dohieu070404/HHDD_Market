/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function slugify(input) {
  return (input || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function upsertUser({ email, username, name, password, role }) {
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      name,
      role,
      password: hash,
    },
    create: {
      email,
      username,
      name,
      role,
      password: hash,
    },
  });
  return user;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Users
  const admin = await upsertUser({
    email: "admin@shop.local",
    username: "admin",
    name: "Admin",
    password: "Admin@123",
    role: "ADMIN",
  });
  const cs = await upsertUser({
    email: "cs@shop.local",
    username: "cs",
    name: "CS",
    password: "Cs@12345",
    role: "CS",
  });
  const sellerUser = await upsertUser({
    email: "seller@shop.local",
    username: "seller",
    name: "Demo Seller",
    password: "Seller@123",
    role: "SELLER",
  });
  const customer = await upsertUser({
    email: "customer@shop.local",
    username: "customer",
    name: "Demo Customer",
    password: "Customer@123",
    role: "CUSTOMER",
  });

  // Seller profile & shop
  await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: { status: "APPROVED", shopName: "Demo Shop" },
    create: { userId: sellerUser.id, status: "APPROVED", shopName: "Demo Shop" },
  });

  const shopSlug = "demo-shop";
  const shop = await prisma.shop.upsert({
    where: { ownerId: sellerUser.id },
    update: { name: "Demo Shop", slug: shopSlug, status: "ACTIVE", ratingAvg: 4.7, ratingCount: 1245 },
    create: {
      ownerId: sellerUser.id,
      name: "Demo Shop",
      slug: shopSlug,
      description: "Shop demo để test hệ thống",
      status: "ACTIVE",
      ratingAvg: 4.7,
      ratingCount: 1245,
    },
  });

  // Categories
  const categoriesData = [
    {
      name: "Điện tử",
      slug: "dien-tu",
      children: [
        { name: "Điện thoại", slug: "dien-thoai" },
        { name: "Laptop", slug: "laptop" },
        { name: "Thiết bị ngoại vi", slug: "ngoai-vi" },
      ],
    },
    {
      name: "Thời trang",
      slug: "thoi-trang",
      children: [
        { name: "Nam", slug: "thoi-trang-nam" },
        { name: "Nữ", slug: "thoi-trang-nu" },
        { name: "Giày dép", slug: "giay-dep" },
      ],
    },
    {
      name: "Nhà cửa & Đời sống",
      slug: "nha-cua",
      children: [
        { name: "Nhà bếp", slug: "nha-bep" },
        { name: "Trang trí", slug: "trang-tri" },
      ],
    },
    {
      name: "Sức khoẻ & Làm đẹp",
      slug: "lam-dep",
      children: [
        { name: "Chăm sóc da", slug: "cham-soc-da" },
        { name: "Trang điểm", slug: "trang-diem" },
      ],
    },
  ];

  const categories = new Map();
  for (const parent of categoriesData) {
    const p = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, parentId: null },
      create: { name: parent.name, slug: parent.slug, parentId: null },
    });
    categories.set(p.slug, p);

    for (const child of parent.children || []) {
      const c = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: p.id },
        create: { name: child.name, slug: child.slug, parentId: p.id },
      });
      categories.set(c.slug, c);
    }
  }

  // Voucher
  await prisma.voucher.upsert({
    where: { code: "WELCOME10" },
    update: { isActive: true, type: "PERCENT", value: 10, minSubtotal: 100000, maxDiscount: 50000 },
    create: { code: "WELCOME10", type: "PERCENT", value: 10, minSubtotal: 100000, maxDiscount: 50000, isActive: true },
  });

  // Products
  const demoProducts = [
    { name: "Tai nghe Bluetooth", price: 199000, category: "ngoai-vi", thumb: "https://picsum.photos/seed/headphone/600/400" },
    { name: "Bàn phím cơ", price: 699000, category: "ngoai-vi", thumb: "https://picsum.photos/seed/keyboard/600/400" },
    { name: "Chuột gaming", price: 349000, category: "ngoai-vi", thumb: "https://picsum.photos/seed/mouse/600/400" },
    { name: "Điện thoại Android", price: 3899000, category: "dien-thoai", thumb: "https://picsum.photos/seed/phone/600/400" },
    { name: "Laptop văn phòng", price: 12999000, category: "laptop", thumb: "https://picsum.photos/seed/laptop/600/400" },
    { name: "Áo thun basic", price: 159000, category: "thoi-trang-nam", thumb: "https://picsum.photos/seed/shirt/600/400" },
    { name: "Áo khoác gió", price: 399000, category: "thoi-trang-nu", thumb: "https://picsum.photos/seed/jacket/600/400" },
    { name: "Giày sneaker", price: 499000, category: "giay-dep", thumb: "https://picsum.photos/seed/shoes/600/400" },
    { name: "Bình giữ nhiệt", price: 219000, category: "nha-bep", thumb: "https://picsum.photos/seed/bottle/600/400" },
    { name: "Đèn ngủ trang trí", price: 189000, category: "trang-tri", thumb: "https://picsum.photos/seed/lamp/600/400" },
    { name: "Sữa rửa mặt", price: 129000, category: "cham-soc-da", thumb: "https://picsum.photos/seed/skincare/600/400" },
    { name: "Son môi", price: 179000, category: "trang-diem", thumb: "https://picsum.photos/seed/lipstick/600/400" },
  ];

  for (const p of demoProducts) {
    const cat = categories.get(p.category);
    const slug = slugify(p.name);

    const demoRatingCount = Math.floor(50 + Math.random() * 500);
    const demoRatingAvg = Math.round((3.8 + Math.random() * 1.2) * 10) / 10; // 3.8 - 5.0
    const demoSold = Math.floor(Math.random() * 5000);

    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        name: p.name,
        price: p.price,
        thumbnailUrl: p.thumb,
        status: "ACTIVE",
        shopId: shop.id,
        categoryId: cat ? cat.id : null,
        ratingAvg: demoRatingAvg,
        ratingCount: demoRatingCount,
        soldCount: demoSold,
      },
      create: {
        name: p.name,
        slug,
        description: `Mô tả demo cho sản phẩm: ${p.name}`,
        price: p.price,
        thumbnailUrl: p.thumb,
        status: "ACTIVE",
        shopId: shop.id,
        categoryId: cat ? cat.id : null,
        ratingAvg: demoRatingAvg,
        ratingCount: demoRatingCount,
        soldCount: demoSold,
      },
    });

    // Ensure default SKU exists
    const skuCode = `SKU-${product.id}-DEF`;
    await prisma.sKU.upsert({
      where: { skuCode },
      update: { productId: product.id, name: "Default", stock: 200, status: "ACTIVE" },
      create: { productId: product.id, skuCode, name: "Default", stock: 200, status: "ACTIVE" },
    });
  }

  // Add an address for demo customer (nếu chưa có)
  const addrExist = await prisma.address.findFirst({ where: { userId: customer.id } });
  if (!addrExist) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        fullName: "Demo Customer",
        phone: "0900000000",
        line1: "123 Demo Street",
        city: "Hà Nội",
        province: "Hà Nội",
        country: "VN",
        isDefault: true,
      },
    });
  }

  console.log("✅ Seed done.");
  console.log("\nTài khoản demo:");
  console.log("- Admin: admin@shop.local / Admin@123");
  console.log("- CS: cs@shop.local / Cs@12345");
  console.log("- Seller: seller@shop.local / Seller@123");
  console.log("- Customer: customer@shop.local / Customer@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
