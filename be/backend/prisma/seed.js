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

  // Ensure owner is also a ShopMember (role OWNER)
  await prisma.shopMember.upsert({
    where: { shopId_userId: { shopId: shop.id, userId: sellerUser.id } },
    update: { role: "OWNER", status: "ACTIVE" },
    create: { shopId: shop.id, userId: sellerUser.id, role: "OWNER", status: "ACTIVE" },
  });

  async function ensureShopBasics({ shopRow, owner, city, province }) {
    // Ensure owner is also a ShopMember (role OWNER)
    await prisma.shopMember.upsert({
      where: { shopId_userId: { shopId: shopRow.id, userId: owner.id } },
      update: { role: "OWNER", status: "ACTIVE" },
      create: { shopId: shopRow.id, userId: owner.id, role: "OWNER", status: "ACTIVE" },
    });

    // Ensure a pickup address exists (used by shipping/labels later)
    const pickup = await prisma.shopAddress.findFirst({ where: { shopId: shopRow.id, type: "PICKUP" } });
    if (!pickup) {
      await prisma.shopAddress.create({
        data: {
          shopId: shopRow.id,
          type: "PICKUP",
          fullName: owner.name || shopRow.name,
          phone: "0900000000",
          line1: "Kho/điểm lấy hàng demo",
          city: city || "Hà Nội",
          province: province || "Hà Nội",
          country: "VN",
        },
      });
    }

    // Seed at least 2 shipping options so checkout can quote immediately.
    await prisma.shippingConfig.upsert({
      where: { shopId_code: { shopId: shopRow.id, code: "MOCK_STD" } },
      update: {
        carrier: "MOCK",
        serviceName: "Standard",
        isActive: true,
        baseFee: 20000,
        feePerItem: 0,
        feePerKg: 0,
        minDays: 2,
        maxDays: 4,
        codSupported: true,
        zonesJson: null,
      },
      create: {
        shopId: shopRow.id,
        carrier: "MOCK",
        code: "MOCK_STD",
        serviceName: "Standard",
        description: "Giao hàng tiêu chuẩn (demo)",
        isActive: true,
        baseFee: 20000,
        feePerItem: 0,
        feePerKg: 0,
        minDays: 2,
        maxDays: 4,
        codSupported: true,
        zonesJson: null,
      },
    });

    await prisma.shippingConfig.upsert({
      where: { shopId_code: { shopId: shopRow.id, code: "MOCK_EXP" } },
      update: {
        carrier: "MOCK",
        serviceName: "Express",
        isActive: true,
        baseFee: 35000,
        feePerItem: 0,
        feePerKg: 0,
        minDays: 1,
        maxDays: 2,
        codSupported: true,
        zonesJson: null,
      },
      create: {
        shopId: shopRow.id,
        carrier: "MOCK",
        code: "MOCK_EXP",
        serviceName: "Express",
        description: "Giao hàng nhanh (demo)",
        isActive: true,
        baseFee: 35000,
        feePerItem: 0,
        feePerKg: 0,
        minDays: 1,
        maxDays: 2,
        codSupported: true,
        zonesJson: null,
      },
    });
  }

  // Default shipping options for demo shop
  await prisma.shippingConfig.upsert({
    where: { shopId_code: { shopId: shop.id, code: "MOCK_STD" } },
    update: {
      carrier: "MOCK",
      serviceName: "Standard",
      isActive: true,
      baseFee: 20000,
      feePerItem: 0,
      feePerKg: 0,
      minDays: 2,
      maxDays: 4,
      codSupported: true,
      zonesJson: null,
    },
    create: {
      shopId: shop.id,
      carrier: "MOCK",
      code: "MOCK_STD",
      serviceName: "Standard",
      description: "Giao hàng tiêu chuẩn (demo)",
      isActive: true,
      baseFee: 20000,
      feePerItem: 0,
      feePerKg: 0,
      minDays: 2,
      maxDays: 4,
      codSupported: true,
      zonesJson: null,
    },
  });

  await prisma.shippingConfig.upsert({
    where: { shopId_code: { shopId: shop.id, code: "MOCK_EXP" } },
    update: {
      carrier: "MOCK",
      serviceName: "Express",
      isActive: true,
      baseFee: 35000,
      feePerItem: 0,
      feePerKg: 0,
      minDays: 1,
      maxDays: 2,
      codSupported: true,
      zonesJson: null,
    },
    create: {
      shopId: shop.id,
      carrier: "MOCK",
      code: "MOCK_EXP",
      serviceName: "Express",
      description: "Giao hàng nhanh (demo)",
      isActive: true,
      baseFee: 35000,
      feePerItem: 0,
      feePerKg: 0,
      minDays: 1,
      maxDays: 2,
      codSupported: true,
      zonesJson: null,
    },
  });

  // Demo shop voucher
  await prisma.shopVoucher.upsert({
    where: { code: "SHOP10" },
    update: { isActive: true },
    create: {
      shopId: shop.id,
      code: "SHOP10",
      type: "PERCENT",
      value: 10,
      minSubtotal: 100000,
      maxDiscount: 50000,
      isActive: true,
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
      update: { productId: product.id, name: "Default", stock: 200, status: "ACTIVE", costPrice: Math.floor(Number(product.price || 0) * 0.6) || null },
      create: { productId: product.id, skuCode, name: "Default", stock: 200, status: "ACTIVE", costPrice: Math.floor(Number(product.price || 0) * 0.6) || null },
    });
  }

  // ----------------------------------------------------------------
  // Additional demo shops (2-3 shops with specialized categories only)
  // ----------------------------------------------------------------
  const seller2 = await upsertUser({
    email: "seller.giadung@shop.local",
    username: "seller_giadung",
    name: "Seller Gia Dụng",
    password: "Seller@123",
    role: "SELLER",
  });

  const shop2 = await prisma.shop.upsert({
    where: { slug: "gia-dung-house" },
    update: {
      name: "Gia Dụng House",
      description: "Chuyên đồ gia dụng & nhà bếp",
      status: "ACTIVE",
      ownerId: seller2.id,
    },
    create: {
      ownerId: seller2.id,
      name: "Gia Dụng House",
      slug: "gia-dung-house",
      description: "Chuyên đồ gia dụng & nhà bếp",
      status: "ACTIVE",
    },
  });

  await ensureShopBasics({ shopRow: shop2, owner: seller2, city: "TP. Hồ Chí Minh", province: "TP. Hồ Chí Minh" });

  const seller3 = await upsertUser({
    email: "seller.mypham@shop.local",
    username: "seller_mypham",
    name: "Seller Mỹ Phẩm",
    password: "Seller@123",
    role: "SELLER",
  });

  const shop3 = await prisma.shop.upsert({
    where: { slug: "my-pham-safe" },
    update: {
      name: "Mỹ Phẩm Safe",
      description: "Chuyên chăm sóc da & trang điểm",
      status: "ACTIVE",
      ownerId: seller3.id,
    },
    create: {
      ownerId: seller3.id,
      name: "Mỹ Phẩm Safe",
      slug: "my-pham-safe",
      description: "Chuyên chăm sóc da & trang điểm",
      status: "ACTIVE",
    },
  });

  await ensureShopBasics({ shopRow: shop3, owner: seller3, city: "Đà Nẵng", province: "Đà Nẵng" });

  const seller4 = await upsertUser({
    email: "seller.fashion@shop.local",
    username: "seller_fashion",
    name: "Seller Thời Trang",
    password: "Seller@123",
    role: "SELLER",
  });

  const shop4 = await prisma.shop.upsert({
    where: { slug: "fashion-basic" },
    update: {
      name: "Fashion Basic",
      description: "Chuyên thời trang nam/nữ basic",
      status: "ACTIVE",
      ownerId: seller4.id,
    },
    create: {
      ownerId: seller4.id,
      name: "Fashion Basic",
      slug: "fashion-basic",
      description: "Chuyên thời trang nam/nữ basic",
      status: "ACTIVE",
    },
  });

  await ensureShopBasics({ shopRow: shop4, owner: seller4, city: "Hà Nội", province: "Hà Nội" });

  const specializedByShop = [
    {
      shop: shop2,
      products: [
        { name: "Nồi chiên không dầu 5L", price: 1290000, categorySlug: "nha-bep", thumbSeed: "airfryer" },
        { name: "Bộ dao bếp inox 6 món", price: 299000, categorySlug: "nha-bep", thumbSeed: "knife" },
        { name: "Chảo chống dính đáy từ 28cm", price: 459000, categorySlug: "nha-bep", thumbSeed: "pan" },
        { name: "Máy xay sinh tố mini 600W", price: 690000, categorySlug: "nha-bep", thumbSeed: "blender" },
        { name: "Bộ hộp đựng thực phẩm 10pcs", price: 249000, categorySlug: "nha-bep", thumbSeed: "foodbox" },
      ],
    },
    {
      shop: shop3,
      products: [
        { name: "Kem chống nắng SPF50 PA++++", price: 239000, categorySlug: "cham-soc-da", thumbSeed: "sunscreen" },
        { name: "Serum Vitamin C 15%", price: 319000, categorySlug: "cham-soc-da", thumbSeed: "vitc" },
        { name: "Toner dịu nhẹ cho da nhạy cảm", price: 189000, categorySlug: "cham-soc-da", thumbSeed: "toner" },
        { name: "Mascara làm dày mi", price: 179000, categorySlug: "trang-diem", thumbSeed: "mascara" },
        { name: "Phấn phủ kiềm dầu", price: 219000, categorySlug: "trang-diem", thumbSeed: "powder" },
      ],
    },
    {
      shop: shop4,
      products: [
        { name: "Áo hoodie basic form rộng", price: 389000, categorySlug: "thoi-trang-nam", thumbSeed: "hoodie" },
        { name: "Quần jeans slimfit", price: 449000, categorySlug: "thoi-trang-nam", thumbSeed: "jeans" },
        { name: "Áo thun cotton 220gsm", price: 199000, categorySlug: "thoi-trang-nu", thumbSeed: "tshirt" },
        { name: "Chân váy chữ A", price: 329000, categorySlug: "thoi-trang-nu", thumbSeed: "skirt" },
        { name: "Giày sneaker trắng basic", price: 590000, categorySlug: "giay-dep", thumbSeed: "sneaker" },
      ],
    },
  ];

  for (const entry of specializedByShop) {
    for (const p of entry.products) {
      const slug = slugify(`${p.name}-${entry.shop.slug}`);
      // `categories` là Map (slug -> category) nên dùng .get
      const cat = categories.get(p.categorySlug);
      const product = await prisma.product.upsert({
        where: { slug },
        update: {
          name: p.name,
          description: `Mô tả demo cho sản phẩm: ${p.name}`,
          price: p.price,
          thumbnailUrl: `https://picsum.photos/seed/${p.thumbSeed}/640/480`,
          status: "ACTIVE",
          shopId: entry.shop.id,
          categoryId: cat ? cat.id : null,
          ratingAvg: 4.6,
          ratingCount: 30,
          soldCount: 80,
        },
        create: {
          name: p.name,
          slug,
          description: `Mô tả demo cho sản phẩm: ${p.name}`,
          price: p.price,
          thumbnailUrl: `https://picsum.photos/seed/${p.thumbSeed}/640/480`,
          status: "ACTIVE",
          shopId: entry.shop.id,
          categoryId: cat ? cat.id : null,
          ratingAvg: 4.6,
          ratingCount: 30,
          soldCount: 80,
        },
      });

      const skuCode = `SKU-${product.id}-DEF`;
      await prisma.sKU.upsert({
        where: { skuCode },
        update: { productId: product.id, name: "Default", stock: 120, status: "ACTIVE", costPrice: Math.floor(Number(product.price || 0) * 0.6) || null },
        create: { productId: product.id, skuCode, name: "Default", stock: 120, status: "ACTIVE", costPrice: Math.floor(Number(product.price || 0) * 0.6) || null },
      });
    }
  }

  // Some shop vouchers to test the flow
  await prisma.shopVoucher.upsert({
    where: { code: "GD10" },
    update: { shopId: shop2.id, type: "PERCENT", value: 10, minSubtotal: 300000, isActive: true },
    create: { shopId: shop2.id, code: "GD10", type: "PERCENT", value: 10, minSubtotal: 300000, isActive: true },
  });
  await prisma.shopVoucher.upsert({
    where: { code: "BEAUTY20" },
    update: { shopId: shop3.id, type: "FIXED", value: 20000, minSubtotal: 200000, isActive: true },
    create: { shopId: shop3.id, code: "BEAUTY20", type: "FIXED", value: 20000, minSubtotal: 200000, isActive: true },
  });
  await prisma.shopVoucher.upsert({
    where: { code: "FASHION15" },
    update: { shopId: shop4.id, type: "PERCENT", value: 15, minSubtotal: 500000, maxDiscount: 100000, isActive: true },
    create: { shopId: shop4.id, code: "FASHION15", type: "PERCENT", value: 15, minSubtotal: 500000, maxDiscount: 100000, isActive: true },
  });

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
