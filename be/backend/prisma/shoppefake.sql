-- Optional:
-- CREATE DATABASE IF NOT EXISTS your_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE your_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- 1) Core tables
-- =========================

CREATE TABLE IF NOT EXISTS `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `avatarUrl` VARCHAR(191) NULL,
  `password` VARCHAR(191) NOT NULL,
  `role` ENUM('CUSTOMER','SELLER','ADMIN','CS') NOT NULL DEFAULT 'CUSTOMER',
  `isBlocked` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`),
  UNIQUE KEY `User_username_key` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Address` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `line1` VARCHAR(191) NOT NULL,
  `line2` VARCHAR(191) NULL,
  `ward` VARCHAR(191) NULL,
  `district` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `province` VARCHAR(191) NULL,
  `country` VARCHAR(191) NOT NULL DEFAULT 'VN',
  `postalCode` VARCHAR(191) NULL,
  `isDefault` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Address_userId_idx` (`userId`),
  CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PasswordResetToken` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `PasswordResetToken_token_key` (`token`),
  KEY `PasswordResetToken_userId_idx` (`userId`),
  CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SellerProfile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `shopName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `taxId` VARCHAR(191) NULL,
  `kycDocumentUrl` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SellerProfile_userId_key` (`userId`),
  CONSTRAINT `SellerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Shop` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ownerId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `logoUrl` VARCHAR(191) NULL,
  `status` ENUM('PENDING','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
  `ratingCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Shop_ownerId_key` (`ownerId`),
  UNIQUE KEY `Shop_slug_key` (`slug`),
  CONSTRAINT `Shop_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ShopAddress` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `type` ENUM('PICKUP','RETURN') NOT NULL DEFAULT 'PICKUP',
  `fullName` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `line1` VARCHAR(191) NOT NULL,
  `line2` VARCHAR(191) NULL,
  `ward` VARCHAR(191) NULL,
  `district` VARCHAR(191) NULL,
  `city` VARCHAR(191) NULL,
  `province` VARCHAR(191) NULL,
  `country` VARCHAR(191) NOT NULL DEFAULT 'VN',
  `postalCode` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ShopAddress_shopId_idx` (`shopId`),
  CONSTRAINT `ShopAddress_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ShippingConfig` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `carrier` VARCHAR(191) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ShippingConfig_shopId_idx` (`shopId`),
  CONSTRAINT `ShippingConfig_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PayoutAccount` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `bankName` VARCHAR(191) NULL,
  `bankAccountName` VARCHAR(191) NULL,
  `bankAccountNumber` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `PayoutAccount_shopId_key` (`shopId`),
  CONSTRAINT `PayoutAccount_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 2) Catalog
-- =========================

CREATE TABLE IF NOT EXISTS `Category` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `parentId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Category_slug_key` (`slug`),
  KEY `Category_parentId_idx` (`parentId`),
  CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Product` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `categoryId` INT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('DRAFT','ACTIVE','HIDDEN','BANNED') NOT NULL DEFAULT 'ACTIVE',
  `price` INT NOT NULL,
  `compareAtPrice` INT NULL,
  `thumbnailUrl` VARCHAR(191) NULL,
  `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
  `ratingCount` INT NOT NULL DEFAULT 0,
  `soldCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Product_slug_key` (`slug`),
  KEY `Product_shopId_idx` (`shopId`),
  KEY `Product_categoryId_idx` (`categoryId`),
  KEY `Product_status_idx` (`status`),
  KEY `Product_ratingAvg_idx` (`ratingAvg`),
  KEY `Product_soldCount_idx` (`soldCount`),
  CONSTRAINT `Product_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ProductImage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `productId` INT NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ProductImage_productId_idx` (`productId`),
  CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SKU` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `productId` INT NOT NULL,
  `skuCode` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `attributesJson` TEXT NULL,
  `price` INT NULL,
  `compareAtPrice` INT NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `weightGram` INT NULL,
  `status` ENUM('ACTIVE','HIDDEN') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SKU_skuCode_key` (`skuCode`),
  KEY `SKU_productId_idx` (`productId`),
  CONSTRAINT `SKU_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 3) Shopping: wishlist, cart, voucher
-- =========================

CREATE TABLE IF NOT EXISTS `WishlistItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `productId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `WishlistItem_userId_productId_key` (`userId`,`productId`),
  KEY `WishlistItem_userId_idx` (`userId`),
  KEY `WishlistItem_productId_idx` (`productId`),
  CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Cart` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Cart_userId_key` (`userId`),
  CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CartItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cartId` INT NOT NULL,
  `skuId` INT NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CartItem_cartId_skuId_key` (`cartId`,`skuId`),
  KEY `CartItem_cartId_idx` (`cartId`),
  KEY `CartItem_skuId_idx` (`skuId`),
  CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CartItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Voucher` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `type` ENUM('PERCENT','FIXED') NOT NULL,
  `value` INT NOT NULL,
  `minSubtotal` INT NOT NULL DEFAULT 0,
  `maxDiscount` INT NULL,
  `startAt` DATETIME(3) NULL,
  `endAt` DATETIME(3) NULL,
  `usageLimit` INT NULL,
  `usedCount` INT NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Voucher_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 4) Orders
-- =========================

CREATE TABLE IF NOT EXISTS `Order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `userId` INT NOT NULL,
  `shopId` INT NOT NULL,
  `status` ENUM(
    'PENDING_PAYMENT','PLACED','CONFIRMED','PACKING','SHIPPED','DELIVERED','COMPLETED',
    'CANCEL_REQUESTED','CANCELLED',
    'RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','RETURN_RECEIVED',
    'REFUND_REQUESTED','REFUNDED','DISPUTED'
  ) NOT NULL DEFAULT 'PLACED',
  `subtotal` INT NOT NULL,
  `shippingFee` INT NOT NULL DEFAULT 0,
  `discount` INT NOT NULL DEFAULT 0,
  `total` INT NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `note` TEXT NULL,

  `shipFullName` VARCHAR(191) NOT NULL,
  `shipPhone` VARCHAR(191) NOT NULL,
  `shipLine1` VARCHAR(191) NOT NULL,
  `shipLine2` VARCHAR(191) NULL,
  `shipWard` VARCHAR(191) NULL,
  `shipDistrict` VARCHAR(191) NULL,
  `shipCity` VARCHAR(191) NULL,
  `shipProvince` VARCHAR(191) NULL,
  `shipCountry` VARCHAR(191) NOT NULL DEFAULT 'VN',
  `shipPostalCode` VARCHAR(191) NULL,

  `voucherId` INT NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `Order_code_key` (`code`),
  KEY `Order_userId_idx` (`userId`),
  KEY `Order_shopId_idx` (`shopId`),
  KEY `Order_status_idx` (`status`),
  KEY `Order_createdAt_idx` (`createdAt`),
  KEY `Order_voucherId_idx` (`voucherId`),
  CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Order_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `OrderItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `productId` INT NOT NULL,
  `skuId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `unitPrice` INT NOT NULL,
  `qty` INT NOT NULL,
  `lineTotal` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OrderItem_orderId_idx` (`orderId`),
  KEY `OrderItem_productId_idx` (`productId`),
  KEY `OrderItem_skuId_idx` (`skuId`),
  CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Payment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `method` ENUM('COD','BANK_TRANSFER','MOCK_GATEWAY') NOT NULL,
  `status` ENUM('UNPAID','AUTHORIZED','CAPTURED','FAILED','REFUNDED') NOT NULL DEFAULT 'UNPAID',
  `amount` INT NOT NULL,
  `provider` VARCHAR(191) NULL,
  `providerRef` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Payment_orderId_idx` (`orderId`),
  KEY `Payment_status_idx` (`status`),
  CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Shipment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `carrier` VARCHAR(191) NOT NULL DEFAULT 'MOCK',
  `trackingCode` VARCHAR(191) NULL,
  `status` ENUM('PENDING','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','RETURNED') NOT NULL DEFAULT 'PENDING',
  `shippedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Shipment_orderId_key` (`orderId`),
  UNIQUE KEY `Shipment_trackingCode_key` (`trackingCode`),
  CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ShipmentEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shipmentId` INT NOT NULL,
  `status` ENUM('PENDING','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','RETURNED') NOT NULL,
  `message` TEXT NULL,
  `location` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ShipmentEvent_shipmentId_idx` (`shipmentId`),
  CONSTRAINT `ShipmentEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 5) Cancel / Return / Refund / Dispute
-- =========================

CREATE TABLE IF NOT EXISTS `CancelRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `userId` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED') NOT NULL DEFAULT 'REQUESTED',
  `resolvedById` INT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CancelRequest_orderId_key` (`orderId`),
  KEY `CancelRequest_userId_idx` (`userId`),
  KEY `CancelRequest_status_idx` (`status`),
  KEY `CancelRequest_resolvedById_idx` (`resolvedById`),
  CONSTRAINT `CancelRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CancelRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CancelRequest_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ReturnRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `userId` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED','RECEIVED','CLOSED') NOT NULL DEFAULT 'REQUESTED',
  `evidenceUrlsJson` TEXT NULL,
  `resolvedById` INT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ReturnRequest_orderId_key` (`orderId`),
  KEY `ReturnRequest_userId_idx` (`userId`),
  KEY `ReturnRequest_status_idx` (`status`),
  KEY `ReturnRequest_resolvedById_idx` (`resolvedById`),
  CONSTRAINT `ReturnRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReturnRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReturnRequest_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Refund` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `amount` INT NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED','PROCESSING','SUCCESS','FAILED') NOT NULL DEFAULT 'REQUESTED',
  `processedById` INT NULL,
  `provider` VARCHAR(191) NULL,
  `providerRef` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Refund_orderId_key` (`orderId`),
  KEY `Refund_status_idx` (`status`),
  KEY `Refund_processedById_idx` (`processedById`),
  CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Refund_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Dispute` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `userId` INT NOT NULL,
  `type` VARCHAR(191) NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('OPEN','UNDER_REVIEW','RESOLVED','REJECTED') NOT NULL DEFAULT 'OPEN',
  `resolution` TEXT NULL,
  `resolvedById` INT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Dispute_orderId_key` (`orderId`),
  KEY `Dispute_status_idx` (`status`),
  KEY `Dispute_userId_idx` (`userId`),
  KEY `Dispute_resolvedById_idx` (`resolvedById`),
  CONSTRAINT `Dispute_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Dispute_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Dispute_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 6) Chat
-- =========================

CREATE TABLE IF NOT EXISTS `ChatThread` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ChatThread_orderId_key` (`orderId`),
  CONSTRAINT `ChatThread_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ChatMessage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `threadId` INT NOT NULL,
  `senderId` INT NOT NULL,
  `message` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ChatMessage_threadId_idx` (`threadId`),
  KEY `ChatMessage_senderId_idx` (`senderId`),
  CONSTRAINT `ChatMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `ChatThread`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 7) Reviews / Reports / Replies
-- =========================

CREATE TABLE IF NOT EXISTS `Review` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `productId` INT NULL,
  `shopId` INT NULL,
  `rating` INT NOT NULL,
  `content` TEXT NULL,
  `mediaUrlsJson` TEXT NULL,
  `status` ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Review_productId_idx` (`productId`),
  KEY `Review_shopId_idx` (`shopId`),
  KEY `Review_status_idx` (`status`),
  UNIQUE KEY `Review_userId_productId_key` (`userId`,`productId`),
  UNIQUE KEY `Review_userId_shopId_key` (`userId`,`shopId`),
  CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Review_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ReviewReply` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `shopId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ReviewReply_reviewId_idx` (`reviewId`),
  KEY `ReviewReply_shopId_idx` (`shopId`),
  CONSTRAINT `ReviewReply_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewReply_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ReviewReport` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `reporterId` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `ReviewReport_reviewId_idx` (`reviewId`),
  KEY `ReviewReport_reporterId_idx` (`reporterId`),
  KEY `ReviewReport_status_idx` (`status`),
  CONSTRAINT `ReviewReport_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================
-- 8) Notifications / Audit / Settings
-- =========================

CREATE TABLE IF NOT EXISTS `Notification` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NULL,
  `dataJson` TEXT NULL,
  `isRead` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `Notification_userId_idx` (`userId`),
  KEY `Notification_isRead_idx` (`isRead`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `actorId` INT NULL,
  `action` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NULL,
  `metadataJson` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_actorId_idx` (`actorId`),
  KEY `AuditLog_action_idx` (`action`),
  KEY `AuditLog_entityType_idx` (`entityType`),
  KEY `AuditLog_createdAt_idx` (`createdAt`),
  CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Setting` (
  `key` VARCHAR(191) NOT NULL,
  `valueJson` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
