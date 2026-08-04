-- CreateEnum
CREATE TYPE "EvaluationCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "EvaluationRaterType" AS ENUM ('SELF', 'MANAGER');

-- CreateEnum
CREATE TYPE "EvaluationResponseStatus" AS ENUM ('PENDING', 'SUBMITTED');

-- CreateTable
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_campaigns" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "EvaluationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "evaluation_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_campaign_competencies" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "evaluation_campaign_competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_participants" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "band" TEXT,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "evaluation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_responses" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "raterType" "EvaluationRaterType" NOT NULL,
    "raterEmployeeId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "summary" TEXT,
    "status" "EvaluationResponseStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competencies_companyId_name_key" ON "competencies"("companyId", "name");

-- CreateIndex
CREATE INDEX "evaluation_campaigns_companyId_status_idx" ON "evaluation_campaigns"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_campaign_competencies_campaignId_competencyId_key" ON "evaluation_campaign_competencies"("campaignId", "competencyId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_participants_campaignId_employeeId_key" ON "evaluation_participants"("campaignId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_responses_participantId_raterType_key" ON "evaluation_responses"("participantId", "raterType");

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_campaigns" ADD CONSTRAINT "evaluation_campaigns_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_campaign_competencies" ADD CONSTRAINT "evaluation_campaign_competencies_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "evaluation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_campaign_competencies" ADD CONSTRAINT "evaluation_campaign_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_participants" ADD CONSTRAINT "evaluation_participants_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "evaluation_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_participants" ADD CONSTRAINT "evaluation_participants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_responses" ADD CONSTRAINT "evaluation_responses_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "evaluation_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
