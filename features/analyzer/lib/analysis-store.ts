// features/analyzer/lib/analysis-store.ts
// Server-only Prisma helpers for the AI Business Analyzer.
// Reads business context from PlaceCache (populated by the Rastreador) and
// persists BusinessAnalysis + AiOpportunity records.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type {
  AiAnalysisOutput,
  AiOpportunityData,
  AnalysisListItem,
  BusinessAnalysisData,
  BusinessContext,
  OppLevel,
  WebSource,
} from "@/features/analyzer/types";

// ─── Read business context from the Rastreador cache ───────────────────────────

export async function getBusinessContext(placeId: string): Promise<BusinessContext | null> {
  const row = await prisma.placeCache.findUnique({
    where: { placeId },
    select: {
      placeId: true,
      name: true,
      formattedAddress: true,
      primaryType: true,
      types: true,
      businessStatus: true,
      rating: true,
      userRatingCount: true,
      websiteUri: true,
      nationalPhone: true,
      googleMapsUri: true,
      hasOpeningHours: true,
      openingHoursDescriptions: true,
    },
  });
  return row;
}

// ─── Read analysis ──────────────────────────────────────────────────────────

export async function getAnalysisByPlaceId(
  placeId: string
): Promise<BusinessAnalysisData | null> {
  const row = await prisma.businessAnalysis.findUnique({
    where: { placeId },
    include: { opportunities: { orderBy: { createdAt: "asc" } } },
  });
  return row ? toAnalysisData(row) : null;
}

/** Lists all stored analyses, most recently updated first, for the landing page. */
export async function listAnalyses(includeArchived = false): Promise<AnalysisListItem[]> {
  const rows = await prisma.businessAnalysis.findMany({
    where: includeArchived ? { archivedAt: { not: null } } : { archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      placeId: true,
      businessName: true,
      summary: true,
      updatedAt: true,
      archivedAt: true,
      opportunities: { select: { selected: true } },
    },
  });
  return rows.map((r) => ({
    placeId: r.placeId,
    businessName: r.businessName,
    summary: r.summary,
    opportunityCount: r.opportunities.length,
    selectedCount: r.opportunities.filter((o) => o.selected).length,
    updatedAt: r.updatedAt.toISOString(),
    archivedAt: r.archivedAt?.toISOString() ?? null,
  }));
}

// ─── Write analysis ─────────────────────────────────────────────────────────

/**
 * Persists a fresh analysis for a business. Replaces any prior analysis and
 * its opportunities (a re-analysis is authoritative).
 */
export async function saveAnalysis(
  ctx: BusinessContext,
  output: AiAnalysisOutput,
  model: string,
  raw: unknown
): Promise<BusinessAnalysisData> {
  const data = {
    businessName: ctx.name,
    model,
    summary: output.summary,
    assets: output.assets as unknown as Prisma.InputJsonValue,
    webFindings: output.webFindings as unknown as Prisma.InputJsonValue,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };

  const row = await prisma.$transaction(async (tx) => {
    const analysis = await tx.businessAnalysis.upsert({
      where: { placeId: ctx.placeId },
      create: { placeId: ctx.placeId, ...data },
      update: data,
    });

    // Replace opportunities wholesale.
    await tx.aiOpportunity.deleteMany({ where: { analysisId: analysis.id } });
    if (output.opportunities.length > 0) {
      await tx.aiOpportunity.createMany({
        data: output.opportunities.map((o) => ({
          analysisId: analysis.id,
          title: o.title,
          description: o.description,
          development: o.development,
          impact: o.impact,
          effort: o.effort,
        })),
      });
    }

    return tx.businessAnalysis.findUniqueOrThrow({
      where: { id: analysis.id },
      include: { opportunities: { orderBy: { createdAt: "asc" } } },
    });
  });

  return toAnalysisData(row);
}

/** Archives a BusinessAnalysis (soft-delete). */
export async function archiveAnalysis(placeId: string): Promise<void> {
  await prisma.businessAnalysis.update({ where: { placeId }, data: { archivedAt: new Date() } });
}

/** Restores an archived BusinessAnalysis. */
export async function restoreAnalysis(placeId: string): Promise<void> {
  await prisma.businessAnalysis.update({ where: { placeId }, data: { archivedAt: null } });
}

/** Permanently deletes a BusinessAnalysis and all cascaded AI records. */
export async function deleteAnalysis(placeId: string): Promise<void> {
  await prisma.businessAnalysis.delete({ where: { placeId } });
}

/** Toggles whether an opportunity is selected for the MVP Factory. */
export async function setOpportunitySelected(
  opportunityId: string,
  selected: boolean
): Promise<void> {
  await prisma.aiOpportunity.update({
    where: { id: opportunityId },
    data: { selected },
  });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type AnalysisRow = Prisma.BusinessAnalysisGetPayload<{
  include: { opportunities: true };
}>;

function toAnalysisData(row: AnalysisRow): BusinessAnalysisData {
  return {
    id: row.id,
    placeId: row.placeId,
    businessName: row.businessName,
    model: row.model,
    summary: row.summary,
    assets: toStringArray(row.assets),
    webFindings: toWebFindings(row.webFindings),
    opportunities: row.opportunities.map(toOpportunityData),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toOpportunityData(o: AnalysisRow["opportunities"][number]): AiOpportunityData {
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    development: o.development,
    impact: (o.impact as OppLevel | null) ?? null,
    effort: (o.effort as OppLevel | null) ?? null,
    selected: o.selected,
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toWebFindings(value: Prisma.JsonValue): { text: string; sources: WebSource[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { text: "", sources: [] };
  }
  const o = value as Record<string, unknown>;
  const sources = Array.isArray(o.sources)
    ? o.sources
        .map((s) => {
          if (typeof s !== "object" || s === null) return null;
          const r = s as Record<string, unknown>;
          const url = typeof r.url === "string" ? r.url : "";
          if (!url) return null;
          return { title: typeof r.title === "string" && r.title ? r.title : url, url };
        })
        .filter((s): s is WebSource => s !== null)
    : [];
  return { text: typeof o.text === "string" ? o.text : "", sources };
}
