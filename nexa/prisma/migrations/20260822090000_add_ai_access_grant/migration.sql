-- CreateEnum
CREATE TYPE "AiAccessScope" AS ENUM ('TEAM', 'DEPARTMENT', 'COMPANY');

-- CreateTable
CREATE TABLE "ai_access_grants" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "scope" "AiAccessScope" NOT NULL DEFAULT 'TEAM',
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_access_grants_employeeId_key" ON "ai_access_grants"("employeeId");

-- CreateIndex
CREATE INDEX "ai_access_grants_companyId_idx" ON "ai_access_grants"("companyId");

-- AddForeignKey
ALTER TABLE "ai_access_grants" ADD CONSTRAINT "ai_access_grants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_access_grants" ADD CONSTRAINT "ai_access_grants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

