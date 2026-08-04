-- CreateEnum
CREATE TYPE "PotentialLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CalibrationStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- AlterTable
ALTER TABLE "evaluation_participants" ADD COLUMN     "calibratedBand" TEXT,
ADD COLUMN     "calibratedScore" DOUBLE PRECISION,
ADD COLUMN     "calibrationSessionId" TEXT,
ADD COLUMN     "potential" "PotentialLevel",
ADD COLUMN     "potentialNote" TEXT;

-- CreateTable
CREATE TABLE "calibration_sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CalibrationStatus" NOT NULL DEFAULT 'DRAFT',
    "facilitatorEmployeeId" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calibration_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calibration_sessions_companyId_campaignId_idx" ON "calibration_sessions"("companyId", "campaignId");

-- AddForeignKey
ALTER TABLE "evaluation_participants" ADD CONSTRAINT "evaluation_participants_calibrationSessionId_fkey" FOREIGN KEY ("calibrationSessionId") REFERENCES "calibration_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "evaluation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
