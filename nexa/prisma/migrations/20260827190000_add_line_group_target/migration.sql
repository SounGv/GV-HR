-- CreateTable
CREATE TABLE "line_group_targets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'hr-alerts',
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_group_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "line_group_targets_groupId_key" ON "line_group_targets"("groupId");

-- CreateIndex
CREATE INDEX "line_group_targets_companyId_purpose_active_idx" ON "line_group_targets"("companyId", "purpose", "active");

-- AddForeignKey
ALTER TABLE "line_group_targets" ADD CONSTRAINT "line_group_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

