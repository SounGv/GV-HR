-- Records how many days of a leave balance were carried in from the year before.
-- Additive and safe: existing rows get 0, nothing reads the column until the rollover code that ships with it.
ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "carriedDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
