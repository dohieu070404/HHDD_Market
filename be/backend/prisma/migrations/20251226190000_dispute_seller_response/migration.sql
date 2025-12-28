-- Add seller response fields for disputes

ALTER TABLE `Dispute` ADD COLUMN `sellerResponse` TEXT NULL;
ALTER TABLE `Dispute` ADD COLUMN `sellerRespondedAt` DATETIME(3) NULL;
