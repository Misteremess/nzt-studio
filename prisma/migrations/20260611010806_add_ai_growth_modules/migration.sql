-- CreateTable
CREATE TABLE "ai_outreach_sequences" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "rawOutput" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_outreach_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_radar_reports" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "competitors" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "sources" JSONB,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_radar_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_scripts" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "meetingType" "EmailMeetingType" NOT NULL DEFAULT 'CALL',
    "agenda" JSONB NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "objections" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "nextSteps" JSONB NOT NULL,
    "rawOutput" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_call_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_content_plans" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "landingCopy" JSONB NOT NULL,
    "seoNotes" JSONB NOT NULL,
    "rawOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_content_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_transcript_analyses" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "businessName" TEXT,
    "transcript" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "objections" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "sentiment" TEXT NOT NULL,
    "rawOutput" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_transcript_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competitor_radar_reports_placeId_key" ON "competitor_radar_reports"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_call_scripts_proposalId_key" ON "ai_call_scripts"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_content_plans_placeId_key" ON "ai_content_plans"("placeId");

-- AddForeignKey
ALTER TABLE "ai_call_scripts" ADD CONSTRAINT "ai_call_scripts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ai_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
