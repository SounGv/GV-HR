-- CreateEnum
CREATE TYPE "AppraisalFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AppraisalAnswerType" AS ENUM ('RATING', 'CHOICE', 'MULTI_CHOICE', 'SHORT_TEXT', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "AppraisalRaterType" AS ENUM ('SELF', 'MANAGER', 'PEER', 'SUBORDINATE');

-- CreateTable
CREATE TABLE "appraisal_forms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AppraisalFormStatus" NOT NULL DEFAULT 'DRAFT',
    "ratingMax" INTEGER NOT NULL DEFAULT 5,
    "ratingLabels" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appraisal_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_questions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "answerType" "AppraisalAnswerType" NOT NULL,
    "options" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "visibleTo" "AppraisalRaterType"[] DEFAULT ARRAY[]::"AppraisalRaterType"[],

    CONSTRAINT "appraisal_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appraisal_forms_companyId_status_idx" ON "appraisal_forms"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_forms_lineageId_version_key" ON "appraisal_forms"("lineageId", "version");

-- CreateIndex
CREATE INDEX "appraisal_questions_formId_order_idx" ON "appraisal_questions"("formId", "order");

-- AddForeignKey
ALTER TABLE "appraisal_forms" ADD CONSTRAINT "appraisal_forms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_questions" ADD CONSTRAINT "appraisal_questions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "appraisal_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

