-- -------------------------------------------------------------------
-- Add costPrice fields for profit calculation
--
-- 1) SKU.costPrice
-- 2) CheckoutDraftItem.costPrice (snapshot)
-- 3) OrderItem.costPrice (snapshot)
--
-- MySQL 8.x idempotent migration.
-- -------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;
SET @schema := DATABASE();

-- --------------------
-- SKU
-- --------------------

SET @add_sku_cost_price := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'SKU' AND column_name = 'costPrice'
    ),
    'SELECT 1;',
    'ALTER TABLE `SKU` ADD COLUMN `costPrice` INT NULL;'
  )
);
PREPARE stmt FROM @add_sku_cost_price; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------
-- CheckoutDraftItem
-- --------------------

SET @add_draft_item_cost_price := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'CheckoutDraftItem' AND column_name = 'costPrice'
    ),
    'SELECT 1;',
    'ALTER TABLE `CheckoutDraftItem` ADD COLUMN `costPrice` INT NULL;'
  )
);
PREPARE stmt FROM @add_draft_item_cost_price; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------
-- OrderItem
-- --------------------

SET @add_order_item_cost_price := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'OrderItem' AND column_name = 'costPrice'
    ),
    'SELECT 1;',
    'ALTER TABLE `OrderItem` ADD COLUMN `costPrice` INT NULL;'
  )
);
PREPARE stmt FROM @add_order_item_cost_price; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS=1;
