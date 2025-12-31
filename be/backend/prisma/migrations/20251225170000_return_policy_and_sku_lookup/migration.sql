-- 20251225170000_return_policy_and_sku_lookup
-- Adds optional policy fields for return workflow so sellers are protected from abusive returns.

ALTER TABLE `ReturnRequest`
  ADD COLUMN `requestType` VARCHAR(191) NULL AFTER `reason`,
  ADD COLUMN `resolution` VARCHAR(191) NULL AFTER `evidenceUrlsJson`,
  ADD COLUMN `shippingPayer` VARCHAR(191) NULL AFTER `resolution`,
  ADD COLUMN `restockingFee` INT NULL AFTER `shippingPayer`,
  ADD COLUMN `refundAmount` INT NULL AFTER `restockingFee`,
  ADD COLUMN `decisionNote` VARCHAR(191) NULL AFTER `refundAmount`;
