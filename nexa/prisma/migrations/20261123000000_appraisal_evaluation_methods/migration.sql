-- CreateEnum
CREATE TYPE "AppraisalSectionKind" AS ENUM ('KPI', 'OKR', 'COMPETENCY_CORE', 'COMPETENCY_FUNCTIONAL', 'COMPETENCY_LEADERSHIP', 'TASK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CompetencyKind" AS ENUM ('CORE', 'FUNCTIONAL', 'LEADERSHIP');

-- AlterEnum
ALTER TYPE "AppraisalAnswerType" ADD VALUE 'FILE_EVIDENCE';

-- AlterTable
ALTER TABLE "competencies" ADD COLUMN "kind" "CompetencyKind" NOT NULL DEFAULT 'CORE';

-- AlterTable
ALTER TABLE "appraisal_questions" ADD COLUMN "sectionKind" "AppraisalSectionKind" NOT NULL DEFAULT 'CUSTOM';

-- AlterTable
ALTER TABLE "appraisal_rounds" ADD COLUMN "sequential" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "position_duties" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_duties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_duties_positionId_order_idx" ON "position_duties"("positionId", "order");

-- AddForeignKey
ALTER TABLE "position_duties" ADD CONSTRAINT "position_duties_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
