-- CreateEnum
CREATE TYPE "AppraisalCalcMode" AS ENUM ('WEIGHTED', 'SIMPLE');

-- CreateEnum
CREATE TYPE "AppraisalEmployeeSees" AS ENUM ('NEVER', 'AFTER_PUBLISH');

-- CreateEnum
CREATE TYPE "AppraisalResultStatus" AS ENUM ('NOT_CALCULATED', 'CALCULATED', 'APPROVED', 'PUBLISHED', 'ACKNOWLEDGED');

-- AlterTable
ALTER TABLE "appraisal_assignments" ADD COLUMN     "submittedByUserId" TEXT;

-- AlterTable
ALTER TABLE "appraisal_participants" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "calculatedAt" TIMESTAMP(3),
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "overallScore" DOUBLE PRECISION,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "resultStatus" "AppraisalResultStatus" NOT NULL DEFAULT 'NOT_CALCULATED',
ADD COLUMN     "scoreBreakdown" JSONB,
ADD COLUMN     "scorePercent" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "appraisal_settings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "calcMode" "AppraisalCalcMode" NOT NULL DEFAULT 'WEIGHTED',
    "bands" JSONB,
    "approvalLevels" INTEGER NOT NULL DEFAULT 0,
    "employeeSees" "AppraisalEmployeeSees" NOT NULL DEFAULT 'NEVER',
    "ackRequired" BOOLEAN NOT NULL DEFAULT false,
    "ackDays" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "appraisal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_settings_companyId_key" ON "appraisal_settings"("companyId");

-- AddForeignKey
ALTER TABLE "appraisal_settings" ADD CONSTRAINT "appraisal_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

