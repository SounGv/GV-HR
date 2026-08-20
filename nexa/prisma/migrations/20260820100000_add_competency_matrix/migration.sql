-- CreateTable
CREATE TABLE "position_competency_requirements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "position_competency_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_competency_levels" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "note" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_competency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "position_competency_requirements_companyId_idx" ON "position_competency_requirements"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "position_competency_requirements_positionId_competencyId_key" ON "position_competency_requirements"("positionId", "competencyId");

-- CreateIndex
CREATE INDEX "employee_competency_levels_companyId_idx" ON "employee_competency_levels"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_competency_levels_employeeId_competencyId_key" ON "employee_competency_levels"("employeeId", "competencyId");

-- AddForeignKey
ALTER TABLE "position_competency_requirements" ADD CONSTRAINT "position_competency_requirements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_competency_requirements" ADD CONSTRAINT "position_competency_requirements_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_competency_requirements" ADD CONSTRAINT "position_competency_requirements_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competency_levels" ADD CONSTRAINT "employee_competency_levels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competency_levels" ADD CONSTRAINT "employee_competency_levels_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_competency_levels" ADD CONSTRAINT "employee_competency_levels_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

