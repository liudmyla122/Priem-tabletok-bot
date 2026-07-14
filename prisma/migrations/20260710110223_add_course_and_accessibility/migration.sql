-- CreateEnum
CREATE TYPE "AccessibilityMode" AS ENUM ('NONE', 'BLIND', 'DEAF');

-- AlterTable
ALTER TABLE "Medication" ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessibilityMode" "AccessibilityMode" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "Medication_endDate_idx" ON "Medication"("endDate");
