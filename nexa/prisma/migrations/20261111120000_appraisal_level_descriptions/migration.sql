-- Additive only: per-question score descriptions and a per-form "example required at the lowest score" switch.
-- Existing forms keep their behaviour (null descriptions, switch off).
ALTER TABLE "appraisal_forms" ADD COLUMN "noteAtLowest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appraisal_questions" ADD COLUMN "levelDescriptions" JSONB;
