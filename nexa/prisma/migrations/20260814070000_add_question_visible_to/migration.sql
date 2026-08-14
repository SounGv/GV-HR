-- AlterTable
ALTER TABLE "evaluation_template_questions" ADD COLUMN     "visibleTo" "EvaluationRaterType"[] DEFAULT ARRAY[]::"EvaluationRaterType"[];
