-- Enhanced shop moderation: points/strikes/warnings + ratio-based enforcement

-- Extend Shop.status enum (MySQL)
ALTER TABLE `Shop`
  MODIFY `status` ENUM('PENDING','ACTIVE','SUSPENDED','HIDDEN','BANNED','REJECTED') NOT NULL DEFAULT 'PENDING';

-- Add moderation fields to Shop
ALTER TABLE `Shop` ADD COLUMN `suspensionUntil` DATETIME(3) NULL;
ALTER TABLE `Shop` ADD COLUMN `bannedAt` DATETIME(3) NULL;
ALTER TABLE `Shop` ADD COLUMN `violationPoints` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Shop` ADD COLUMN `warningLevel` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Shop` ADD COLUMN `strikes` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `Shop` ADD COLUMN `lastModeratedAt` DATETIME(3) NULL;

-- Create ShopModerationEvent table (audit for moderation decisions)
CREATE TABLE `ShopModerationEvent` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `shopId` INTEGER NOT NULL,
  `actorId` INTEGER NULL,
  `action` ENUM('WARN_1','WARN_2','WARN_3','SUSPEND_7D','SUSPEND_30D','HIDE','UNHIDE','BAN','UNBAN','ADJUST_POINTS') NOT NULL,
  `pointsDelta` INTEGER NOT NULL DEFAULT 0,
  `note` TEXT NULL,
  `meta` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ShopModerationEvent_shopId_idx` (`shopId`),
  INDEX `ShopModerationEvent_action_idx` (`action`),
  INDEX `ShopModerationEvent_createdAt_idx` (`createdAt`),
  CONSTRAINT `ShopModerationEvent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ShopModerationEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Enhance ShopReport with verification, severity, and resolution
ALTER TABLE `ShopReport` ADD COLUMN `category` VARCHAR(50) NULL;
ALTER TABLE `ShopReport` ADD COLUMN `severity` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW';
ALTER TABLE `ShopReport` ADD COLUMN `isVerifiedPurchase` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ShopReport` ADD COLUMN `resolution` ENUM('PENDING','VALID','INVALID','ABUSIVE','DUPLICATE') NOT NULL DEFAULT 'PENDING';
ALTER TABLE `ShopReport` ADD COLUMN `resolutionNote` TEXT NULL;
ALTER TABLE `ShopReport` ADD COLUMN `pointsApplied` INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `ShopReport_resolution_idx` ON `ShopReport`(`resolution`);
CREATE INDEX `ShopReport_verified_idx` ON `ShopReport`(`isVerifiedPurchase`);
