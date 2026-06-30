-- CreateEnum
CREATE TYPE "EmailMeetingType" AS ENUM ('NONE', 'CALL', 'VIDEO_CALL', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "AiAgentChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "AiAgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT');

-- CreateTable
CREATE TABLE "ai_email_drafts" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "meetingType" "EmailMeetingType" NOT NULL DEFAULT 'NONE',
    "meetingNotes" TEXT,
    "references" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rawOutput" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "AiAgentChannel" NOT NULL,
    "status" "AiAgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "clientName" TEXT,
    "phoneNumber" TEXT,
    "emailAddress" TEXT,
    "elevenLabsAgentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);
