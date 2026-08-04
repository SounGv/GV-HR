-- AlterEnum
ALTER TYPE "EvaluationRaterType" ADD VALUE 'PEER';
ALTER TYPE "EvaluationRaterType" ADD VALUE 'UPWARD';

-- DropIndex
DROP INDEX "evaluation_responses_participantId_raterType_key";

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_responses_participantId_raterType_raterEmployeeId_key" ON "evaluation_responses"("participantId", "raterType", "raterEmployeeId");
