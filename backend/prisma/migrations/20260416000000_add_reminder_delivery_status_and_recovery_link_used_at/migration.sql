-- AlterTable: Add deliveryStatus and failedAt to Reminder
ALTER TABLE "Reminder" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE "Reminder" ADD COLUMN "failedAt" TIMESTAMP(3);

-- AlterTable: Add usedAt to RecoveryLink
ALTER TABLE "RecoveryLink" ADD COLUMN "usedAt" TIMESTAMP(3);
