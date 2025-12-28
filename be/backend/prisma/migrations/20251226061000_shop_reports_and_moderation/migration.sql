-- Add moderation fields to Shop
ALTER TABLE `Shop` ADD COLUMN `moderationNote` TEXT NULL;
ALTER TABLE `Shop` ADD COLUMN `suspendedAt` DATETIME(3) NULL;

-- Create ShopReport table
CREATE TABLE `ShopReport` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shopId` INTEGER NOT NULL,
  `reporterId` INTEGER NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `status` ENUM('OPEN','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  `resolvedAt` DATETIME(3) NULL,
  `resolvedById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ShopReport_shopId_idx` (`shopId`),
  INDEX `ShopReport_reporterId_idx` (`reporterId`),
  INDEX `ShopReport_status_idx` (`status`),
  INDEX `ShopReport_createdAt_idx` (`createdAt`),
  CONSTRAINT `ShopReport_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ShopReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ShopReport_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
