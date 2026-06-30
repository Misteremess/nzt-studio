// features/transcript-analyzer/lib/store.ts
// Server-only Prisma helpers for the Transcript Analyzer.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  Sentiment,
  TranscriptAnalysisData,
  TranscriptAnalysisOutput,
  TranscriptAnalyzerInput,
  TranscriptObjection,
} from "@/features/transcript-analyzer/types";

export async function listTranscriptAnalyses(includeArchived = false): Promise<TranscriptAnalysisData[]> {
  const rows = await prisma.aiTranscriptAnalysis.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toTranscriptAnalysisData);
}

export async function createTranscriptAnalysis(
  input: TranscriptAnalyzerInput,
  output: TranscriptAnalysisOutput,
  model: string,
  raw: unknown
): Promise<TranscriptAnalysisData> {
  const row = await prisma.aiTranscriptAnalysis.create({
    data: {
      model,
      businessName: input.businessName?.trim() || null,
      transcript: input.transcript,
      summary: output.summary,
      requirements: output.requirements as unknown as Prisma.InputJsonValue,
      objections: output.objections as unknown as Prisma.InputJsonValue,
      actionItems: output.actionItems as unknown as Prisma.InputJsonValue,
      sentiment: output.sentiment,
      rawOutput: (raw ?? null) as Prisma.InputJsonValue,
    },
  });
  return toTranscriptAnalysisData(row);
}

export async function archiveTranscriptAnalysis(id: string): Promise<void> {
  await prisma.aiTranscriptAnalysis.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function restoreTranscriptAnalysis(id: string): Promise<void> {
  await prisma.aiTranscriptAnalysis.update({ where: { id }, data: { archivedAt: null } });
}

export async function deleteTranscriptAnalysis(id: string): Promise<void> {
  await prisma.aiTranscriptAnalysis.delete({ where: { id } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type TranscriptAnalysisRow = Prisma.AiTranscriptAnalysisGetPayload<object>;

function toTranscriptAnalysisData(row: TranscriptAnalysisRow): TranscriptAnalysisData {
  return {
    id: row.id,
    model: row.model,
    businessName: row.businessName,
    transcript: row.transcript,
    summary: row.summary,
    requirements: toStringArray(row.requirements),
    objections: toObjections(row.objections),
    actionItems: toStringArray(row.actionItems),
    sentiment: toSentiment(row.sentiment),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toObjections(value: Prisma.JsonValue): TranscriptObjection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const objection = typeof r.objection === "string" ? r.objection : "";
      const response = typeof r.response === "string" ? r.response : "";
      if (!objection) return null;
      return { objection, response };
    })
    .filter((o): o is TranscriptObjection => o !== null);
}

function toSentiment(value: string): Sentiment {
  if (value === "positive" || value === "neutral" || value === "negative") return value;
  return "neutral";
}
