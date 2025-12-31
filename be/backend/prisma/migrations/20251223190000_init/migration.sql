-- -------------------------------------------------------------
-- Initial migration (baseline)
-- Target database: MySQL 8.x
-- Charset: utf8mb4
-- -------------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;

-- CreateTable
CREATE TABLE `User` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `avatarUrl` VARCHAR(191) NULL,
  `password` VARCHAR(191) NOT NULL,
  `role` ENUM('CUSTOMER','SELLER','ADMIN','CS') NOT NULL DEFAULT 'CUSTOMER',
  `isBlocked` BOOLEAN NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `User_email_key`(`email`),
  UNIQUE INDEX `User_username_key`(`username`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SellerProfile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `shopName` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL,
  `taxId` VARCHAR(191) NULL,
  `kycDocumentUrl` VARCHAR(191) NULL,
  `rejectedReason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SellerProfile_userId_key`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SellerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shop` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ownerId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `logoUrl` VARCHAR(191) NULL,
  `status` ENUM('PENDING','ACTIVE','SUSPENDED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `ratingAvg` DOUBLE NOT NULL DEFAULT 0,
  `ratingCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Shop_ownerId_key`(`ownerId`),
  UNIQUE INDEX `Shop_slug_key`(`slug`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Shop_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayoutAccount` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `bankName` VARCHAR(191) NULL,
  `bankAccountName` VARCHAR(191) NULL,
  `bankAccountNumber` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PayoutAccount_shopId_key`(`shopId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PayoutAccount_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopAddress` (
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

  INDEX `ShopAddress_shopId_idx`(`shopId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ShopAddress_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingConfig` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `carrier` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `ShippingConfig_shopId_idx`(`shopId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ShippingConfig_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Address` (
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
  `isDefault` BOOLEAN NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `Address_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
  INDEX `PasswordResetToken_userId_idx`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `parentId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Category_slug_key`(`slug`),
  INDEX `Category_parentId_idx`(`parentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
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

  UNIQUE INDEX `Product_slug_key`(`slug`),
  INDEX `Product_shopId_idx`(`shopId`),
  INDEX `Product_categoryId_idx`(`categoryId`),
  INDEX `Product_status_idx`(`status`),
  INDEX `Product_ratingAvg_idx`(`ratingAvg`),
  INDEX `Product_soldCount_idx`(`soldCount`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Product_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductImage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `productId` INT NOT NULL,
  `url` VARCHAR(191) NOT NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,

  INDEX `ProductImage_productId_idx`(`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ProductImage_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SKU` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `productId` INT NOT NULL,
  `skuCode` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `attributesJson` LONGTEXT NULL,
  `price` INT NULL,
  `compareAtPrice` INT NULL,
  `stock` INT NOT NULL DEFAULT 0,
  `weightGram` INT NULL,
  `status` ENUM('ACTIVE','HIDDEN') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `SKU_skuCode_key`(`skuCode`),
  INDEX `SKU_productId_idx`(`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SKU_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WishlistItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `productId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WishlistItem_userId_productId_key`(`userId`, `productId`),
  INDEX `WishlistItem_userId_idx`(`userId`),
  INDEX `WishlistItem_productId_idx`(`productId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WishlistItem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WishlistItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cart` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Cart_userId_key`(`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Cart_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CartItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cartId` INT NOT NULL,
  `skuId` INT NOT NULL,
  `qty` INT NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CartItem_cartId_skuId_key`(`cartId`, `skuId`),
  INDEX `CartItem_cartId_idx`(`cartId`),
  INDEX `CartItem_skuId_idx`(`skuId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CartItem_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `Cart`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CartItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
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
  `isActive` BOOLEAN NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Voucher_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `groupCode` VARCHAR(191) NULL,
  `userId` INT NOT NULL,
  `shopId` INT NOT NULL,
  `status` ENUM('PENDING_PAYMENT','PLACED','CONFIRMED','PACKING','SHIPPED','DELIVERED','COMPLETED','CANCEL_REQUESTED','CANCELLED','RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','RETURN_RECEIVED','REFUND_REQUESTED','REFUNDED','DISPUTED') NOT NULL DEFAULT 'PLACED',
  `subtotal` INT NOT NULL,
  `shippingFee` INT NOT NULL DEFAULT 0,
  `discount` INT NOT NULL DEFAULT 0,
  `total` INT NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `note` VARCHAR(191) NULL,

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

  UNIQUE INDEX `Order_code_key`(`code`),
  INDEX `Order_userId_idx`(`userId`),
  INDEX `Order_shopId_idx`(`shopId`),
  INDEX `Order_status_idx`(`status`),
  INDEX `Order_createdAt_idx`(`createdAt`),
  INDEX `Order_groupCode_idx`(`groupCode`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Order_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Order_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `productId` INT NOT NULL,
  `skuId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `unitPrice` INT NOT NULL,
  `qty` INT NOT NULL,
  `lineTotal` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `OrderItem_orderId_idx`(`orderId`),
  INDEX `OrderItem_productId_idx`(`productId`),
  INDEX `OrderItem_skuId_idx`(`skuId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
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

  INDEX `Payment_orderId_idx`(`orderId`),
  INDEX `Payment_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shipment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `carrier` VARCHAR(191) NOT NULL DEFAULT 'MOCK',
  `trackingCode` VARCHAR(191) NULL,
  `status` ENUM('PENDING','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','RETURNED') NOT NULL DEFAULT 'PENDING',
  `shippedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Shipment_orderId_key`(`orderId`),
  UNIQUE INDEX `Shipment_trackingCode_key`(`trackingCode`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Shipment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shipmentId` INT NOT NULL,
  `status` ENUM('PENDING','READY_TO_SHIP','SHIPPED','IN_TRANSIT','DELIVERED','RETURNED') NOT NULL,
  `message` VARCHAR(191) NULL,
  `location` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ShipmentEvent_shipmentId_idx`(`shipmentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ShipmentEvent_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `Shipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CancelRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `userId` INT NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED') NOT NULL DEFAULT 'REQUESTED',
  `resolvedById` INT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CancelRequest_orderId_key`(`orderId`),
  INDEX `CancelRequest_userId_idx`(`userId`),
  INDEX `CancelRequest_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CancelRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CancelRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CancelRequest_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReturnRequest` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `userId` INT NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED','RECEIVED','CLOSED') NOT NULL DEFAULT 'REQUESTED',
  `evidenceUrlsJson` LONGTEXT NULL,
  `resolvedById` INT NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ReturnRequest_orderId_key`(`orderId`),
  INDEX `ReturnRequest_userId_idx`(`userId`),
  INDEX `ReturnRequest_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReturnRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReturnRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReturnRequest_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Refund` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `amount` INT NOT NULL,
  `reason` VARCHAR(191) NULL,
  `status` ENUM('REQUESTED','APPROVED','REJECTED','PROCESSING','SUCCESS','FAILED') NOT NULL DEFAULT 'REQUESTED',
  `processedById` INT NULL,
  `provider` VARCHAR(191) NULL,
  `providerRef` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Refund_orderId_key`(`orderId`),
  INDEX `Refund_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Refund_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Refund_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dispute` (
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

  UNIQUE INDEX `Dispute_orderId_key`(`orderId`),
  INDEX `Dispute_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Dispute_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Dispute_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Dispute_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatThread` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orderId` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ChatThread_orderId_key`(`orderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ChatThread_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `threadId` INT NOT NULL,
  `senderId` INT NOT NULL,
  `message` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ChatMessage_threadId_idx`(`threadId`),
  INDEX `ChatMessage_senderId_idx`(`senderId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ChatMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `ChatThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `productId` INT NULL,
  `shopId` INT NULL,
  `rating` INT NOT NULL,
  `content` TEXT NULL,
  `mediaUrlsJson` LONGTEXT NULL,
  `status` ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Review_userId_productId_key`(`userId`, `productId`),
  UNIQUE INDEX `Review_userId_shopId_key`(`userId`, `shopId`),
  INDEX `Review_productId_idx`(`productId`),
  INDEX `Review_shopId_idx`(`shopId`),
  INDEX `Review_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Review_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Review_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewReply` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `shopId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ReviewReply_reviewId_idx`(`reviewId`),
  INDEX `ReviewReply_shopId_idx`(`shopId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReviewReply_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewReply_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReviewReport` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `reporterId` INT NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('OPEN','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,

  INDEX `ReviewReport_reviewId_idx`(`reviewId`),
  INDEX `ReviewReport_reporterId_idx`(`reporterId`),
  INDEX `ReviewReport_status_idx`(`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ReviewReport_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NULL,
  `dataJson` LONGTEXT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `Notification_userId_idx`(`userId`),
  INDEX `Notification_isRead_idx`(`isRead`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `actorId` INT NULL,
  `action` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NULL,
  `metadataJson` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AuditLog_actorId_idx`(`actorId`),
  INDEX `AuditLog_action_idx`(`action`),
  INDEX `AuditLog_entityType_idx`(`entityType`),
  INDEX `AuditLog_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
  `key` VARCHAR(191) NOT NULL,
  `valueJson` LONGTEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
