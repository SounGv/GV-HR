-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "breakEndAt" TIMESTAMP(3),
ADD COLUMN     "breakStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "requesterEmployeeId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approverEmployeeId" TEXT,
    "approverUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_swap_requests_companyId_status_idx" ON "shift_swap_requests"("companyId", "status");

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "shift_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requesterEmployeeId_fkey" FOREIGN KEY ("requesterEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
