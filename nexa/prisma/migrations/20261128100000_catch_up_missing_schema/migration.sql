-- Catch-up for what schema.prisma has but no earlier migration creates: one enum, one table and nine columns.
-- The live database already has all of them (it was filled with `db push`), so every statement here is
-- written to do nothing when the object exists. On a fresh database this makes `migrate deploy` build the
-- complete schema. Found by comparing `prisma migrate diff --from-empty` with the migration folders.

-- Enum for attendance correction requests
DO $$ BEGIN
  CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table: attendance_correction_requests
CREATE TABLE IF NOT EXISTS "attendance_correction_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "requestedClockIn" TIMESTAMP(3),
    "requestedClockOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "approverEmployeeId" TEXT,
    "approverUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attendance_correction_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_correction_requests_companyId_status_idx" ON "attendance_correction_requests"("companyId", "status");
CREATE INDEX IF NOT EXISTS "attendance_correction_requests_employeeId_status_idx" ON "attendance_correction_requests"("employeeId", "status");

DO $$ BEGIN
  ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_correction_requests" ADD CONSTRAINT "attendance_correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "lineUserId" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "lineLinkCode" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "lineLinkCodeExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "employees_lineUserId_key" ON "employees"("lineUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "employees_lineLinkCode_key" ON "employees"("lineLinkCode");

ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "earlyLeaveOut" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "attachmentUrl" TEXT;

ALTER TABLE "payroll_records" ADD COLUMN IF NOT EXISTS "manualAdjustments" JSONB;
ALTER TABLE "payroll_records" ADD COLUMN IF NOT EXISTS "note" TEXT;
