-- CreateTable
CREATE TABLE "brand_identities" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "colors" JSONB NOT NULL,
    "fontHeading" TEXT,
    "fontBody" TEXT,
    "styleNotes" TEXT,
    "logoImage" TEXT,
    "logoImageMime" TEXT,
    "referenceImage" TEXT,
    "referenceImageMime" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_identities_analysisId_key" ON "brand_identities"("analysisId");

-- AddForeignKey
ALTER TABLE "brand_identities" ADD CONSTRAINT "brand_identities_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "business_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
