-- CreateTable
CREATE TABLE "business_analyses" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "assets" JSONB NOT NULL,
    "webFindings" JSONB NOT NULL,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_opportunities" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "development" TEXT NOT NULL,
    "impact" TEXT,
    "effort" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_analyses_placeId_key" ON "business_analyses"("placeId");

-- CreateIndex
CREATE INDEX "ai_opportunities_analysisId_idx" ON "ai_opportunities"("analysisId");

-- AddForeignKey
ALTER TABLE "ai_opportunities" ADD CONSTRAINT "ai_opportunities_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "business_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
