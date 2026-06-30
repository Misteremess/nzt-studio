-- CreateTable
CREATE TABLE "ai_seo_audits" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "businessName" TEXT,
    "model" TEXT NOT NULL,
    "technical" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "rawOutput" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_seo_audits_pkey" PRIMARY KEY ("id")
);
