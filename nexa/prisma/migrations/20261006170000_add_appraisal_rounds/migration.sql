-- CreateEnum
CREATE TYPE "AppraisalRoundStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AppraisalAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "appraisal_rounds" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formSnapshot" JSONB,
    "raterTypes" "AppraisalRaterType"[] DEFAULT ARRAY[]::"AppraisalRaterType"[],
    "perspectiveWeights" JSONB,
    "startDate" DATE,
    "endDate" DATE,
    "remind" BOOLEAN NOT NULL DEFAULT true,
    "notifyLine" BOOLEAN NOT NULL DEFAULT true,
    "status" "AppraisalRoundStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appraisal_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_participants" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "departmentName" TEXT,
    "positionName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appraisal_assignments" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "raterEmployeeId" TEXT NOT NULL,
    "raterType" "AppraisalRaterType" NOT NULL,
    "status" "AppraisalAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "answers" JSONB,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appraisal_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appraisal_rounds_companyId_status_idx" ON "appraisal_rounds"("companyId", "status");

-- CreateIndex
CREATE INDEX "appraisal_participants_employeeId_idx" ON "appraisal_participants"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_participants_roundId_employeeId_key" ON "appraisal_participants"("roundId", "employeeId");

-- CreateIndex
CREATE INDEX "appraisal_assignments_raterEmployeeId_status_idx" ON "appraisal_assignments"("raterEmployeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "appraisal_assignments_participantId_raterEmployeeId_raterTy_key" ON "appraisal_assignments"("participantId", "raterEmployeeId", "raterType");

-- AddForeignKey
ALTER TABLE "appraisal_rounds" ADD CONSTRAINT "appraisal_rounds_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_rounds" ADD CONSTRAINT "appraisal_rounds_formId_fkey" FOREIGN KEY ("formId") REFERENCES "appraisal_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_participants" ADD CONSTRAINT "appraisal_participants_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "appraisal_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_participants" ADD CONSTRAINT "appraisal_participants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_assignments" ADD CONSTRAINT "appraisal_assignments_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "appraisal_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appraisal_assignments" ADD CONSTRAINT "appraisal_assignments_raterEmployeeId_fkey" FOREIGN KEY ("raterEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

