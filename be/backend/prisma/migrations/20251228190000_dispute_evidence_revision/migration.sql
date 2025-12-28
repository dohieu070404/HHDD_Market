-- Add evidence images + revision-request flow for disputes

ALTER TABLE `Dispute`
  ADD COLUMN `mediaUrlsJson` TEXT NULL,
  ADD COLUMN `revisionRequestedAt` DATETIME(3) NULL,
  ADD COLUMN `revisionRequestedById` INT NULL,
  ADD COLUMN `revisionRequestedByRole` VARCHAR(191) NULL,
  ADD COLUMN `revisionRequestNote` TEXT NULL,
  ADD COLUMN `editCount` INT NOT NULL DEFAULT 0;

-- FK for revision requester
ALTER TABLE `Dispute`
  ADD CONSTRAINT `Dispute_revisionRequestedById_fkey` FOREIGN KEY (`revisionRequestedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Helpful index for admin filtering
CREATE INDEX `Dispute_revisionRequestedAt_idx` ON `Dispute`(`revisionRequestedAt`);
