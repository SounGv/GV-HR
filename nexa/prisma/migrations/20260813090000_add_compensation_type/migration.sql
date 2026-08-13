-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "compensationType" "CompensationType" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "dailyRate" DECIMAL(12,2),
ADD COLUMN     "hourlyRate" DECIMAL(12,2);
