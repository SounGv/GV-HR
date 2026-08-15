-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "attendanceDeductionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateDeductionPerOccurrence" DECIMAL(12,2) NOT NULL DEFAULT 0;

