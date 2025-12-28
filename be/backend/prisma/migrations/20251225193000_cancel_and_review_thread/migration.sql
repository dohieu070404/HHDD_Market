-- 20251225193000_cancel_and_review_thread
-- Adds originalStatus for cancel requests (restore status if seller rejects)
-- Adds one-time edit counts for reviews/replies
-- Improves review content fields to TEXT (avoid truncation)
-- Adds simple follow-up messages (buyer -> seller) for review negotiation thread.

-- 1) Cancel request: store original order status at request time
ALTER TABLE `CancelRequest`
  ADD COLUMN `originalStatus` ENUM(
    'PENDING_PAYMENT',
    'PLACED',
    'CONFIRMED',
    'PACKING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'CANCEL_REQUESTED',
    'CANCELLED',
    'RETURN_REQUESTED',
    'RETURN_APPROVED',
    'RETURN_REJECTED',
    'RETURN_RECEIVED',
    'REFUND_REQUESTED',
    'REFUNDED',
    'DISPUTED'
  ) NOT NULL DEFAULT 'CONFIRMED' AFTER `userId`;

-- 2) Reviews: allow 1 edit only + avoid truncation
ALTER TABLE `Review`
  MODIFY COLUMN `content` TEXT NULL,
  ADD COLUMN `editCount` INT NOT NULL DEFAULT 0 AFTER `content`,
  MODIFY COLUMN `mediaUrlsJson` TEXT NULL;

ALTER TABLE `ReviewReply`
  MODIFY COLUMN `content` TEXT NOT NULL,
  ADD COLUMN `editCount` INT NOT NULL DEFAULT 0 AFTER `content`,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER `createdAt`;

-- 3) Follow-up messages (buyer -> seller)
CREATE TABLE `ReviewBuyerFollowUp` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `userId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReviewBuyerFollowUp_reviewId_key` (`reviewId`),
  INDEX `ReviewBuyerFollowUp_userId_idx` (`userId`),
  CONSTRAINT `ReviewBuyerFollowUp_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewBuyerFollowUp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReviewSellerFollowUp` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reviewId` INT NOT NULL,
  `shopId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReviewSellerFollowUp_reviewId_key` (`reviewId`),
  INDEX `ReviewSellerFollowUp_shopId_idx` (`shopId`),
  CONSTRAINT `ReviewSellerFollowUp_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `Review`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReviewSellerFollowUp_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `Shop`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
