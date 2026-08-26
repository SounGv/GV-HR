-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_username_key" ON "users"("companyId", "username");

-- At least one login identifier must be set — email and username can't both
-- be null (they can both be set at once, that's fine).
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_username_check"
  CHECK ("email" IS NOT NULL OR "username" IS NOT NULL);
