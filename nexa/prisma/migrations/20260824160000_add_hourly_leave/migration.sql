-- CreateEnum
CREATE TYPE "LeaveUnit" AS ENUM ('DAY', 'HOUR');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "leaveQuotaPersonalHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "leaveQuotaSickHours" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leave_balances" ADD COLUMN     "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "usedHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "hours" DOUBLE PRECISION,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "unit" "LeaveUnit" NOT NULL DEFAULT 'DAY';

