-- CreateEnum
CREATE TYPE "AppraisalRecurrenceFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AppraisalAdjustmentKind" AS ENUM ('ADJUST', 'REVERT');

-- AlterTable
ALTER TABLE "appraisal_participants" ADD COLUMN     "adjustedAt" TIMESTAMP(3),
ADD COLUMN     "originalGrade" TEXT,
ADD COLUMN     "originalScorePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "appraisal_rounds" ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "recurrenceId" TEXT;

-- CreateTable
CREATE TABLE "appraisal_recurrences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "AppraisalRecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "openDay" INTEGER NOT NULL,
    "closeDay" INTEGER NOT NULL,
    "formId" TEXT NOT NULL,
    "preset" TEXT NOT NULL,
    "departmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appraisal_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_score_adjustments" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "kind" "AppraisalAdjustmentKind" NOT NULL,
    "fromPercent" DOUBLE PRECISION NOT NULL,
    "toPercent" DOUBLE PRECISION NOT NULL,
    "fromGrade" TEXT,
    "toGrade" TEXT,
    "reason" TEXT NOT NULL,
    "byUserId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_score_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appraisal_recurrences_companyId_enabled_idx" ON "appraisal_recurrences"("companyId", "enabled");

-- CreateIndex
CREATE INDEX "appraisal_score_adjustments_participantId_createdAt_idx" ON "appraisal_score_adjustments"("participantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_rounds_recurrenceId_periodKey_key" ON "appraisal_rounds"("recurrenceId", "periodKey");

-- AddForeignKey
ALTER TABLE "appraisal_rounds" ADD CONSTRAINT "appraisal_rounds_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "appraisal_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_recurrences" ADD CONSTRAINT "appraisal_recurrences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_recurrences" ADD CONSTRAINT "appraisal_recurrences_formId_fkey" FOREIGN KEY ("formId") REFERENCES "appraisal_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_score_adjustments" ADD CONSTRAINT "appraisal_score_adjustments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "appraisal_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

