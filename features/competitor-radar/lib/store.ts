// features/competitor-radar/lib/store.ts
// Server-only Prisma helpers for the Competitor Radar.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  CompetitorRadarCandidate,
  CompetitorRadarOutput,
  CompetitorRadarReportData,
  RadarCompetitor,
  RadarSource,
} from "@/features/competitor-radar/types";
import type { AiSource } from "@/lib/ai/provider";

/** Lists analyzed businesses, with whether a competitor radar report already exists. */
export async function listCompetitorRadarCandidates(): Promise<CompetitorRadarCandidate[]> {
  const analyses = await prisma.businessAnalysis.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { placeId: true, businessName: true, summary: true },
  });
  if (analyses.length === 0) return [];

  const placeIds = analyses.map((a) => a.placeId);
  const [placeCaches, reports] = await Promise.all([
    prisma.placeCache.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true, primaryType: true, formattedAddress: true },
    }),
    prisma.competitorRadarReport.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true },
    }),
  ]);

  const placeCacheByPlaceId = new Map(placeCaches.map((p) => [p.placeId, p]));
  const reportPlaceIds = new Set(reports.map((r) => r.placeId));

  return analyses.map((a) => {
    const cache = placeCacheByPlaceId.get(a.placeId);
    return {
      placeId: a.placeId,
      businessName: a.businessName,
      primaryType: cache?.primaryType ?? null,
      formattedAddress: cache?.formattedAddress ?? null,
      summary: a.summary,
      hasReport: reportPlaceIds.has(a.placeId),
    };
  });
}

export async function getCompetitorRadarReport(placeId: string): Promise<CompetitorRadarReportData | null> {
  const row = await prisma.competitorRadarReport.findUnique({ where: { placeId } });
  return row ? toReportData(row) : null;
}

export async function listCompetitorRadarReports(): Promise<CompetitorRadarReportData[]> {
  const rows = await prisma.competitorRadarReport.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(toReportData);
}

/** Creates or replaces the competitor radar report for a business (1:1 relation). */
export async function upsertCompetitorRadarReport(
  input: { placeId: string; businessName: string },
  output: CompetitorRadarOutput,
  sources: AiSource[],
  model: string,
  raw: unknown
): Promise<CompetitorRadarReportData> {
  const data = {
    businessName: input.businessName,
    model,
    competitors: output.competitors as unknown as Prisma.InputJsonValue,
    gaps: output.gaps as unknown as Prisma.InputJsonValue,
    summary: output.summary,
    sources: sources as unknown as Prisma.InputJsonValue,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };
  const row = await prisma.competitorRadarReport.upsert({
    where: { placeId: input.placeId },
    create: { placeId: input.placeId, ...data },
    update: data,
  });
  return toReportData(row);
}

export async function deleteCompetitorRadarReport(placeId: string): Promise<void> {
  await prisma.competitorRadarReport.delete({ where: { placeId } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type ReportRow = Prisma.CompetitorRadarReportGetPayload<object>;

function toReportData(row: ReportRow): CompetitorRadarReportData {
  return {
    id: row.id,
    placeId: row.placeId,
    businessName: row.businessName,
    model: row.model,
    competitors: toCompetitors(row.competitors),
    gaps: toStringArray(row.gaps),
    summary: row.summary,
    sources: toSources(row.sources),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toCompetitors(value: Prisma.JsonValue): RadarCompetitor[] {
  if (!Array.isArray(value)) return [];
  const out: RadarCompetitor[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    if (!name) continue;
    const website = typeof r.website === "string" && r.website ? r.website : undefined;
    const strengths = Array.isArray(r.strengths) ? r.strengths.filter((s): s is string => typeof s === "string") : [];
    const weaknesses = Array.isArray(r.weaknesses) ? r.weaknesses.filter((s): s is string => typeof s === "string") : [];
    out.push(website ? { name, website, strengths, weaknesses } : { name, strengths, weaknesses });
  }
  return out;
}

function toSources(value: Prisma.JsonValue | null): RadarSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
      const r = v as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const url = typeof r.url === "string" ? r.url : "";
      if (!url) return null;
      return { title: title || url, url };
    })
    .filter((s): s is RadarSource => s !== null);
}
