-- CreateEnum
CREATE TYPE "AttendanceWorkMode" AS ENUM ('ONSITE', 'WFH');

-- CreateEnum
CREATE TYPE "AttendanceMood" AS ENUM ('TERRIBLE', 'BAD', 'OK', 'GOOD', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "RecognitionType" AS ENUM ('STAR', 'AWARD', 'HEART', 'POINT');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "moodOut" "AttendanceMood",
ADD COLUMN     "workMode" "AttendanceWorkMode" NOT NULL DEFAULT 'ONSITE';

-- CreateTable
CREATE TABLE "recognitions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "givenByUserId" TEXT NOT NULL,
    "givenByEmployeeId" TEXT,
    "type" "RecognitionType" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "recognitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recognitions_companyId_employeeId_idx" ON "recognitions"("companyId", "employeeId");

-- CreateIndex
CREATE INDEX "recognitions_companyId_type_idx" ON "recognitions"("companyId", "type");

-- AddForeignKey
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recognitions" ADD CONSTRAINT "recognitions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
