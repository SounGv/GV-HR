-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "leaveQuotaAnnualDays" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "leaveQuotaPersonalDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "leaveQuotaSickDays" INTEGER NOT NULL DEFAULT 30;

