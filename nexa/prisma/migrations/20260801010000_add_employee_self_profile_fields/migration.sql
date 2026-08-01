-- Employee self-service profile: bank branch, richer address, emergency contact
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "bankBranch"               TEXT,
  ADD COLUMN IF NOT EXISTS "subDistrict"              TEXT,
  ADD COLUMN IF NOT EXISTS "country"                  TEXT DEFAULT 'ไทย',
  ADD COLUMN IF NOT EXISTS "emergencyContactName"     TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactPhone"    TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;
