-- Additive only: a section name per question, and the reusable question bank (คลังหัวข้อ).
ALTER TABLE "appraisal_questions" ADD COLUMN "section" TEXT;

CREATE TABLE "appraisal_question_bank" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "section" TEXT,
    "answerType" "AppraisalAnswerType" NOT NULL,
    "levelDescriptions" JSONB,
    "scaleMax" INTEGER NOT NULL DEFAULT 5,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "appraisal_question_bank_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "appraisal_question_bank_companyId_deletedAt_idx" ON "appraisal_question_bank"("companyId", "deletedAt");
