-- CreateEnum
CREATE TYPE "EvaluationTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EvaluationAnswerType" AS ENUM ('NUMERIC', 'LETTER', 'CHOICE', 'YES_NO', 'LONG_TEXT');

-- AlterTable
ALTER TABLE "evaluation_campaigns" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateSnapshot" JSONB;

-- AlterTable
ALTER TABLE "evaluation_responses" ADD COLUMN     "answers" JSONB;

-- AlterTable
ALTER TABLE "evaluation_schedule_templates" ADD COLUMN     "evaluationTemplateId" TEXT;

-- CreateTable
CREATE TABLE "evaluation_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EvaluationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "evaluation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "evaluation_template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_template_questions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "answerType" "EvaluationAnswerType" NOT NULL,
    "options" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "evaluation_template_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_templates_companyId_status_idx" ON "evaluation_templates"("companyId", "status");

-- CreateIndex
CREATE INDEX "evaluation_template_sections_templateId_order_idx" ON "evaluation_template_sections"("templateId", "order");

-- CreateIndex
CREATE INDEX "evaluation_template_questions_sectionId_order_idx" ON "evaluation_template_questions"("sectionId", "order");

-- AddForeignKey
ALTER TABLE "evaluation_campaigns" ADD CONSTRAINT "evaluation_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "evaluation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_schedule_templates" ADD CONSTRAINT "evaluation_schedule_templates_evaluationTemplateId_fkey" FOREIGN KEY ("evaluationTemplateId") REFERENCES "evaluation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_templates" ADD CONSTRAINT "evaluation_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_template_sections" ADD CONSTRAINT "evaluation_template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "evaluation_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_template_questions" ADD CONSTRAINT "evaluation_template_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "evaluation_template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
