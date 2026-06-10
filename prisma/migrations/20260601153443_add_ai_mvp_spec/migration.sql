-- CreateTable
CREATE TABLE "ai_mvp_specs" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "targetUser" TEXT NOT NULL,
    "coreFeatures" JSONB NOT NULL,
    "futureFeatures" JSONB NOT NULL,
    "techStack" JSONB NOT NULL,
    "phases" JSONB NOT NULL,
    "timeline" TEXT NOT NULL,
    "complexity" TEXT,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_mvp_specs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_mvp_specs_opportunityId_key" ON "ai_mvp_specs"("opportunityId");

-- AddForeignKey
ALTER TABLE "ai_mvp_specs" ADD CONSTRAINT "ai_mvp_specs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "ai_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
