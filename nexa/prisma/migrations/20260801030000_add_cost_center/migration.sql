-- Cost Center: finance/budget grouping for employees
CREATE TABLE IF NOT EXISTS "cost_centers" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cost_centers_companyId_code_key" ON "cost_centers" ("companyId", "code");
CREATE INDEX IF NOT EXISTS "cost_centers_companyId_deletedAt_idx" ON "cost_centers" ("companyId", "deletedAt");

ALTER TABLE "cost_centers"
  ADD CONSTRAINT "cost_centers_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "costCenterId" TEXT;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "cost_centers" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
