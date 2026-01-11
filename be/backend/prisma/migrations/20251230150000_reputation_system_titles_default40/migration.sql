-- Add reputation score to Shop
ALTER TABLE `Shop`
  ADD COLUMN `reputationScore` DOUBLE NOT NULL DEFAULT 40,
  ADD COLUMN `reputationUpdatedAt` DATETIME(3) NULL;

UPDATE `Shop` SET `reputationScore` = 40 WHERE `reputationScore` IS NULL;

-- Extend Dispute with severity and penalty fields
ALTER TABLE `Dispute`
  ADD COLUMN `severity` ENUM('LEVEL_1','LEVEL_2','LEVEL_3','LEVEL_4') NOT NULL DEFAULT 'LEVEL_1',
  ADD COLUMN `penaltyPoints` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `penaltyApplied` BOOLEAN NOT NULL DEFAULT FALSE;

-- Extend Review with reputation points awarded for rollback
ALTER TABLE `Review`
  ADD COLUMN `reputationPointsAwarded` DOUBLE NOT NULL DEFAULT 0;

-- Extend ReturnRequest with reputation penalty applied flag
ALTER TABLE `ReturnRequest`
  ADD COLUMN `reputationPenaltyApplied` BOOLEAN NOT NULL DEFAULT FALSE;

-- Create reputation event log
CREATE TABLE `ShopReputationEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopId` INT NOT NULL,
  `delta` DOUBLE NOT NULL,
  `beforeScore` DOUBLE NOT NULL,
  `afterScore` DOUBLE NOT NULL,
  `source` VARCHAR(191) NULL,
  `refType` VARCHAR(191) NULL,
  `refId` INT NULL,
  `note` TEXT NULL,
  `actorId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ShopReputationEvent_shopId_createdAt_idx` (`shopId`, `createdAt`),
  INDEX `ShopReputationEvent_actorId_idx` (`actorId`),
  CONSTRAINT `ShopReputationEvent_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ShopReputationEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
