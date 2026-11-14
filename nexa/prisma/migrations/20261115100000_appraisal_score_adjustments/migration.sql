-- CreateEnum
CREATE TYPE "AppraisalAdjustmentKind" AS ENUM ('ADJUST', 'REVERT');

-- AlterTable
ALTER TABLE "appraisal_participants" ADD COLUMN     "adjustedAt" TIMESTAMP(3),
ADD COLUMN     "originalGrade" TEXT,
ADD COLUMN     "originalScorePercent" DOUBLE PRECISION;

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
CREATE INDEX "appraisal_score_adjustments_participantId_createdAt_idx" ON "appraisal_score_adjustments"("participantId", "createdAt");

-- AddForeignKey
ALTER TABLE "appraisal_score_adjustments" ADD CONSTRAINT "appraisal_score_adjustments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "appraisal_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

