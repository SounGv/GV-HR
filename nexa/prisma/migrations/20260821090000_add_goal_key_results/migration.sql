-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "parentGoalId" TEXT;

-- CreateIndex
CREATE INDEX "goals_parentGoalId_idx" ON "goals"("parentGoalId");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

