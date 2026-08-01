-- Smart Attendance: selfie photo, GPS accuracy, and device metadata per punch
ALTER TABLE "attendance_records"
  ADD COLUMN IF NOT EXISTS "clockInPhotoUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "clockOutPhotoUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "clockInAccuracy"   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "clockOutAccuracy"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "clockInDevice"     TEXT,
  ADD COLUMN IF NOT EXISTS "clockOutDevice"    TEXT;
