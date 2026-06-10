-- CreateTable
CREATE TABLE "ai_pricings" (
    "id" TEXT NOT NULL,
    "mvpSpecId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "setupPrice" INTEGER NOT NULL,
    "monthlyPrice" INTEGER,
    "tiers" JSONB NOT NULL,
    "recommendedTier" TEXT,
    "paymentTerms" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" TEXT NOT NULL,
    "mvpSpecId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "proposedSolution" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "outOfScope" JSONB NOT NULL,
    "deliverables" JSONB NOT NULL,
    "phases" JSONB NOT NULL,
    "terms" JSONB NOT NULL,
    "nextSteps" JSONB NOT NULL,
    "investment" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_pricings_mvpSpecId_key" ON "ai_pricings"("mvpSpecId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_proposals_mvpSpecId_key" ON "ai_proposals"("mvpSpecId");

-- AddForeignKey
ALTER TABLE "ai_pricings" ADD CONSTRAINT "ai_pricings_mvpSpecId_fkey" FOREIGN KEY ("mvpSpecId") REFERENCES "ai_mvp_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_mvpSpecId_fkey" FOREIGN KEY ("mvpSpecId") REFERENCES "ai_mvp_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
