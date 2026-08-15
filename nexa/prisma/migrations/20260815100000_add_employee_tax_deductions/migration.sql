-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "taxChildrenEnhanced" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxChildrenStandard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxHealthInsurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxLifeInsurance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxParentCareCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxSpouseNoIncome" BOOLEAN NOT NULL DEFAULT false;

