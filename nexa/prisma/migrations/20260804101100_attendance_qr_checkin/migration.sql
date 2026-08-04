-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "clockInViaQr" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clockOutViaQr" BOOLEAN NOT NULL DEFAULT false;
