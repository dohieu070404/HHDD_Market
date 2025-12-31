-- -------------------------------------------------------------------
-- Voucher loyalty constraints + Draft shop voucher support
--
-- 1) Add loyalty thresholds to Voucher and ShopVoucher:
--    - minBuyerSpendMonth (INT, default 0)
--    - minBuyerSpendYear  (INT, default 0)
--    0 means no restriction.
--
-- 2) Add shop voucher fields to CheckoutDraftGroup:
--    - shopDiscount (INT, default 0)
--    - shopVoucherId (nullable FK -> ShopVoucher.id)
--
-- This migration is written idempotently for MySQL 8.x.
-- -------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS=0;
SET @schema := DATABASE();

-- --------------------
-- Voucher
-- --------------------

SET @add_voucher_min_month := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'Voucher' AND column_name = 'minBuyerSpendMonth'
    ),
    'SELECT 1;',
    'ALTER TABLE `Voucher` ADD COLUMN `minBuyerSpendMonth` INT NOT NULL DEFAULT 0;'
  )
);
PREPARE stmt FROM @add_voucher_min_month; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_voucher_min_year := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'Voucher' AND column_name = 'minBuyerSpendYear'
    ),
    'SELECT 1;',
    'ALTER TABLE `Voucher` ADD COLUMN `minBuyerSpendYear` INT NOT NULL DEFAULT 0;'
  )
);
PREPARE stmt FROM @add_voucher_min_year; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------
-- ShopVoucher
-- --------------------

SET @add_shop_voucher_min_month := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'ShopVoucher' AND column_name = 'minBuyerSpendMonth'
    ),
    'SELECT 1;',
    'ALTER TABLE `ShopVoucher` ADD COLUMN `minBuyerSpendMonth` INT NOT NULL DEFAULT 0;'
  )
);
PREPARE stmt FROM @add_shop_voucher_min_month; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_shop_voucher_min_year := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'ShopVoucher' AND column_name = 'minBuyerSpendYear'
    ),
    'SELECT 1;',
    'ALTER TABLE `ShopVoucher` ADD COLUMN `minBuyerSpendYear` INT NOT NULL DEFAULT 0;'
  )
);
PREPARE stmt FROM @add_shop_voucher_min_year; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- --------------------
-- CheckoutDraftGroup
-- --------------------

SET @add_draft_group_shop_discount := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'CheckoutDraftGroup' AND column_name = 'shopDiscount'
    ),
    'SELECT 1;',
    'ALTER TABLE `CheckoutDraftGroup` ADD COLUMN `shopDiscount` INT NOT NULL DEFAULT 0;'
  )
);
PREPARE stmt FROM @add_draft_group_shop_discount; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_draft_group_shop_voucher_id := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = @schema AND table_name = 'CheckoutDraftGroup' AND column_name = 'shopVoucherId'
    ),
    'SELECT 1;',
    'ALTER TABLE `CheckoutDraftGroup` ADD COLUMN `shopVoucherId` INT NULL;'
  )
);
PREPARE stmt FROM @add_draft_group_shop_voucher_id; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index for shopVoucherId (optional but useful)
SET @add_draft_group_shop_voucher_idx := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = @schema AND table_name = 'CheckoutDraftGroup' AND index_name = 'CheckoutDraftGroup_shopVoucherId_idx'
    ),
    'SELECT 1;',
    'CREATE INDEX `CheckoutDraftGroup_shopVoucherId_idx` ON `CheckoutDraftGroup`(`shopVoucherId`);'
  )
);
PREPARE stmt FROM @add_draft_group_shop_voucher_idx; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FK only if not exists
SET @add_draft_group_shop_voucher_fk := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.key_column_usage
      WHERE table_schema = @schema
        AND table_name = 'CheckoutDraftGroup'
        AND column_name = 'shopVoucherId'
        AND referenced_table_name = 'ShopVoucher'
    ),
    'SELECT 1;',
    'ALTER TABLE `CheckoutDraftGroup`
       ADD CONSTRAINT `CheckoutDraftGroup_shopVoucherId_fkey`
       FOREIGN KEY (`shopVoucherId`) REFERENCES `ShopVoucher`(`id`)
       ON DELETE SET NULL ON UPDATE CASCADE;'
  )
);
PREPARE stmt FROM @add_draft_group_shop_voucher_fk; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET FOREIGN_KEY_CHECKS=1;
