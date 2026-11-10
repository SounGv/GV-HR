-- CreateEnum
CREATE TYPE "HalfDayPeriod" AS ENUM ('MORNING', 'AFTERNOON');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "halfDayPeriod" "HalfDayPeriod";
