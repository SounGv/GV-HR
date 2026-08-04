-- AlterTable
ALTER TABLE "evaluation_campaigns" ADD COLUMN     "scheduleTemplateId" TEXT;

-- CreateTable
CREATE TABLE "evaluation_schedule_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT NOT NULL,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "raterTypes" "EvaluationRaterType"[] DEFAULT ARRAY['SELF', 'MANAGER']::"EvaluationRaterType"[],
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "evaluation_schedule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_schedule_competencies" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "evaluation_schedule_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_schedule_templates_active_nextRunAt_idx" ON "evaluation_schedule_templates"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_schedule_competencies_templateId_competencyId_key" ON "evaluation_schedule_competencies"("templateId", "competencyId");

-- AddForeignKey
ALTER TABLE "evaluation_campaigns" ADD CONSTRAINT "evaluation_campaigns_scheduleTemplateId_fkey" FOREIGN KEY ("scheduleTemplateId") REFERENCES "evaluation_schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_schedule_templates" ADD CONSTRAINT "evaluation_schedule_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_schedule_templates" ADD CONSTRAINT "evaluation_schedule_templates_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_schedule_competencies" ADD CONSTRAINT "evaluation_schedule_competencies_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "evaluation_schedule_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_schedule_competencies" ADD CONSTRAINT "evaluation_schedule_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
