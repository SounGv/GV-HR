-- AlterTable
ALTER TABLE "competencies" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "exampleBehavior" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "evaluation_campaigns" ADD COLUMN     "raterTypes" "EvaluationRaterType"[] DEFAULT ARRAY['SELF', 'MANAGER']::"EvaluationRaterType"[];

-- CreateTable
CREATE TABLE "competency_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_categories_companyId_name_key" ON "competency_categories"("companyId", "name");

-- AddForeignKey
ALTER TABLE "competency_categories" ADD CONSTRAINT "competency_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "competency_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
