-- -------------------------------------------------------------
-- Fix review constraints
-- - Allow buyers to review multiple products within the same shop
-- - Ensure seller reply is unique per review
-- Target database: MySQL 8.x
-- Charset: utf8mb4
-- -------------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;

-- Drop unique index that incorrectly limits 1 review per shop per user
SET @schema := DATABASE();

SET @drop_review_user_shop := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = @schema
        AND table_name = 'Review'
        AND index_name = 'Review_userId_shopId_key'
    ),
    'ALTER TABLE `Review` DROP INDEX `Review_userId_shopId_key`;',
    'SELECT 1;'
  )
);
PREPARE stmt FROM @drop_review_user_shop;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add non-unique index for common queries (optional but recommended)
SET @add_review_user_shop_idx := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = @schema
        AND table_name = 'Review'
        AND index_name = 'Review_userId_shopId_idx'
    ),
    'SELECT 1;',
    'CREATE INDEX `Review_userId_shopId_idx` ON `Review`(`userId`, `shopId`);'
  )
);
PREPARE stmt FROM @add_review_user_shop_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure only one reply per review per shop (upsert-friendly)
SET @add_reply_unique := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = @schema
        AND table_name = 'ReviewReply'
        AND index_name = 'ReviewReply_reviewId_shopId_key'
    ),
    'SELECT 1;',
    'ALTER TABLE `ReviewReply` ADD UNIQUE INDEX `ReviewReply_reviewId_shopId_key`(`reviewId`, `shopId`);'
  )
);
PREPARE stmt FROM @add_reply_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS=1;
