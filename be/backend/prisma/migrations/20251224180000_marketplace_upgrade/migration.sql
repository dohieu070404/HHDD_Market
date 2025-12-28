-- -------------------------------------------------------------
-- Marketplace upgrade migration
-- Adds: checkout drafts, idempotency, shipping options, seller center extensions
-- Target database: MySQL 8.x
-- Charset: utf8mb4
-- -------------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;

-- -------------------------------------------------------------
-- ShippingConfig: upgrade thành "shipping options" (carrier/method)
-- -------------------------------------------------------------
ALTER TABLE `ShippingConfig`
  ADD COLUMN `code` VARCHAR(64) NOT NULL DEFAULT 'CFG',
  ADD COLUMN `serviceName` VARCHAR(191) NOT NULL DEFAULT 'Standard',
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `baseFee` INT NOT NULL DEFAULT 0,
  ADD COLUMN `feePerItem` INT NOT NULL DEFAULT 0,
  ADD COLUMN `feePerKg` INT NOT NULL DEFAULT 0,
  ADD COLUMN `freeShippingOver` INT NULL,
  ADD COLUMN `minDays` INT NOT NULL DEFAULT 2,
  ADD COLUMN `maxDays` INT NOT NULL DEFAULT 4,
  ADD COLUMN `maxWeightGram` INT NULL,
  ADD COLUMN `codSupported` BOOLEAN NOT NULL DEFAULT 1,
  ADD COLUMN `zonesJson` LONGTEXT NULL;

-- Backfill cho dữ liệu cũ (nếu có) để không đụng unique(shopId, code)
UPDATE `ShippingConfig`
SET `code` = CONCAT('CFG_', `id`),
    `serviceName` = `carrier`
WHERE `code` = 'CFG';

CREATE INDEX `ShippingConfig_isActive_idx` ON `ShippingConfig`(`isActive`);
CREATE INDEX `ShippingConfig_carrier_idx` ON `ShippingConfig`(`carrier`);
ALTER TABLE `ShippingConfig`
  ADD UNIQUE INDEX `ShippingConfig_shopId_code_key`(`shopId`, `code`);

-- -------------------------------------------------------------
-- Idempotency keys (exactly-once create order/payment/shipment)
-- -------------------------------------------------------------
CREATE TABLE `IdempotencyKey` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `scope` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `requestHash` VARCHAR(191) NOT NULL,
  `status` ENUM('IN_PROGRESS','SUCCESS','FAILED') NOT NULL DEFAULT 'IN_PROGRESS',
  `httpStatus` INT NULL,
  `responseJson` LONGTEXT NULL,
  `errorJson` LONGTEXT NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `IdempotencyKey_userId_scope_key_key`(`userId`, `scope`, `key`),
  INDEX `IdempotencyKey_userId_idx`(`userId`),
  INDEX `IdempotencyKey_scope_idx`(`scope`),
  INDEX `IdempotencyKey_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `IdempotencyKey_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Checkout Draft (order draft / cart snapshot)
-- -------------------------------------------------------------
CREATE TABLE `CheckoutDraft` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `userId` INT NOT NULL,
  `status` ENUM('DRAFT','COMMITTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `subtotal` INT NOT NULL DEFAULT 0,
  `shippingTotal` INT NOT NULL DEFAULT 0,
  `discountTotal` INT NOT NULL DEFAULT 0,
  `total` INT NOT NULL DEFAULT 0,
  `note` VARCHAR(191) NULL,
  `voucherId` INT NULL,
  `voucherCode` VARCHAR(191) NULL,

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

  `expiresAt` DATETIME(3) NULL,
  `committedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CheckoutDraft_code_key`(`code`),
  INDEX `CheckoutDraft_userId_idx`(`userId`),
  INDEX `CheckoutDraft_status_idx`(`status`),
  INDEX `CheckoutDraft_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CheckoutDraft_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraft_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutDraftGroup` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `draftId` INT NOT NULL,
  `shopId` INT NOT NULL,

  `subtotal` INT NOT NULL DEFAULT 0,
  `shippingFee` INT NOT NULL DEFAULT 0,
  `discount` INT NOT NULL DEFAULT 0,
  `total` INT NOT NULL DEFAULT 0,

  `shippingConfigId` INT NULL,
  `shippingCarrier` VARCHAR(191) NULL,
  `shippingServiceName` VARCHAR(191) NULL,
  `shippingOptionCode` VARCHAR(191) NULL,
  `etaMinDays` INT NULL,
  `etaMaxDays` INT NULL,

  `errorCode` VARCHAR(191) NULL,
  `errorMessage` VARCHAR(191) NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `CheckoutDraftGroup_draftId_shopId_key`(`draftId`, `shopId`),
  INDEX `CheckoutDraftGroup_draftId_idx`(`draftId`),
  INDEX `CheckoutDraftGroup_shopId_idx`(`shopId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CheckoutDraftGroup_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `CheckoutDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftGroup_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftGroup_shippingConfigId_fkey` FOREIGN KEY (`shippingConfigId`) REFERENCES `ShippingConfig`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CheckoutDraftItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `draftId` INT NOT NULL,
  `groupId` INT NOT NULL,
  `shopId` INT NOT NULL,

  `skuId` INT NOT NULL,
  `productId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `unitPrice` INT NOT NULL,
  `qty` INT NOT NULL,
  `weightGram` INT NULL,
  `lineTotal` INT NOT NULL,

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `CheckoutDraftItem_draftId_idx`(`draftId`),
  INDEX `CheckoutDraftItem_groupId_idx`(`groupId`),
  INDEX `CheckoutDraftItem_shopId_idx`(`shopId`),
  INDEX `CheckoutDraftItem_skuId_idx`(`skuId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CheckoutDraftItem_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `CheckoutDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftItem_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `CheckoutDraftGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftItem_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftItem_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `SKU`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CheckoutDraftItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Seller center: shop members/roles
-- -------------------------------------------------------------
CREATE TABLE `ShopMember` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `userId` INT NOT NULL,
  `role` ENUM('OWNER','MANAGER','STAFF') NOT NULL DEFAULT 'STAFF',
  `status` ENUM('ACTIVE','INVITED','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `ShopMember_shopId_userId_key`(`shopId`, `userId`),
  INDEX `ShopMember_shopId_idx`(`shopId`),
  INDEX `ShopMember_userId_idx`(`userId`),
  INDEX `ShopMember_role_idx`(`role`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ShopMember_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ShopMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Seller center: shop vouchers
-- -------------------------------------------------------------
CREATE TABLE `ShopVoucher` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
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

  UNIQUE INDEX `ShopVoucher_code_key`(`code`),
  INDEX `ShopVoucher_shopId_idx`(`shopId`),
  INDEX `ShopVoucher_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`),
  CONSTRAINT `ShopVoucher_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Order: snapshot shipping option + shop voucher
ALTER TABLE `Order`
  ADD COLUMN `shippingCarrier` VARCHAR(191) NULL,
  ADD COLUMN `shippingServiceName` VARCHAR(191) NULL,
  ADD COLUMN `shippingOptionCode` VARCHAR(191) NULL,
  ADD COLUMN `shippingEtaMinDays` INT NULL,
  ADD COLUMN `shippingEtaMaxDays` INT NULL,
  ADD COLUMN `shopVoucherId` INT NULL;

CREATE INDEX `Order_shopVoucherId_idx` ON `Order`(`shopVoucherId`);

ALTER TABLE `Order`
  ADD CONSTRAINT `Order_shopVoucherId_fkey` FOREIGN KEY (`shopVoucherId`) REFERENCES `ShopVoucher`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- -------------------------------------------------------------
-- Seller center: finance/payout
-- -------------------------------------------------------------
CREATE TABLE `Payout` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `amount` INT NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'VND',
  `status` ENUM('REQUESTED','APPROVED','REJECTED','PAID') NOT NULL DEFAULT 'REQUESTED',
  `note` VARCHAR(191) NULL,
  `requestedById` INT NOT NULL,
  `processedById` INT NULL,
  `processedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `Payout_shopId_idx`(`shopId`),
  INDEX `Payout_status_idx`(`status`),
  INDEX `Payout_requestedById_idx`(`requestedById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Payout_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Payout_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Payout_processedById_fkey` FOREIGN KEY (`processedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
