-- AlterEnum
ALTER TYPE "ExpenseStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "expense_claims" ADD COLUMN     "hospitalName" TEXT,
ADD COLUMN     "sickLeaveRequestId" TEXT;

-- CreateTable
CREATE TABLE "company_loan_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "salarySnapshot" DECIMAL(12,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "attachmentUrl" TEXT,
    "repaidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "approverEmployeeId" TEXT,
    "approverUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "company_loan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_loan_requests_companyId_status_idx" ON "company_loan_requests"("companyId", "status");

-- CreateIndex
CREATE INDEX "company_loan_requests_employeeId_year_idx" ON "company_loan_requests"("employeeId", "year");

-- AddForeignKey
ALTER TABLE "company_loan_requests" ADD CONSTRAINT "company_loan_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_loan_requests" ADD CONSTRAINT "company_loan_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

