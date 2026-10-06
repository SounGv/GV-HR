-- CreateTable
CREATE TABLE "appraisal_kpi_profiles" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "bands" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "appraisal_kpi_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appraisal_kpi_profiles_companyId_idx" ON "appraisal_kpi_profiles"("companyId");

-- AddForeignKey
ALTER TABLE "appraisal_kpi_profiles" ADD CONSTRAINT "appraisal_kpi_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

