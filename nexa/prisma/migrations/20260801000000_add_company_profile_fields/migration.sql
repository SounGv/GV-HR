-- Company Profile: branding, contact, and address fields
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "logoDarkUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "faviconUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "signatureUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "stampUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "brandColor"    TEXT,
  ADD COLUMN IF NOT EXISTS "language"      TEXT NOT NULL DEFAULT 'th',
  ADD COLUMN IF NOT EXISTS "phone"         TEXT,
  ADD COLUMN IF NOT EXISTS "email"         TEXT,
  ADD COLUMN IF NOT EXISTS "website"       TEXT,
  ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine"   TEXT,
  ADD COLUMN IF NOT EXISTS "subDistrict"   TEXT,
  ADD COLUMN IF NOT EXISTS "district"      TEXT,
  ADD COLUMN IF NOT EXISTS "province"      TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode"    TEXT,
  ADD COLUMN IF NOT EXISTS "country"       TEXT DEFAULT 'ไทย';
