-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "leaveQuotaAnnualDays" DROP NOT NULL,
ALTER COLUMN "leaveQuotaAnnualDays" DROP DEFAULT,
ALTER COLUMN "leaveQuotaPersonalDays" DROP NOT NULL,
ALTER COLUMN "leaveQuotaPersonalDays" DROP DEFAULT,
ALTER COLUMN "leaveQuotaSickDays" DROP NOT NULL,
ALTER COLUMN "leaveQuotaSickDays" DROP DEFAULT;
