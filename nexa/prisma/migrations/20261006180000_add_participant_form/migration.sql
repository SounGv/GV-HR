-- AlterTable
ALTER TABLE "appraisal_participants" ADD COLUMN     "formId" TEXT;

-- CreateIndex
CREATE INDEX "appraisal_participants_formId_idx" ON "appraisal_participants"("formId");

-- AddForeignKey
ALTER TABLE "appraisal_participants" ADD CONSTRAINT "appraisal_participants_formId_fkey" FOREIGN KEY ("formId") REFERENCES "appraisal_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

