// features/opportunity-engine/lib/store.ts
// Server-only Prisma reads for the Opportunity Engine. Aggregates every
// AI-detected opportunity (across all business analyses) and enriches each with
// its downstream pipeline state (spec / pricing / proposal) and a priority score.
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { OppLevel } from "@/features/analyzer/types";
import { priorityScore, quadrantOf } from "@/features/opportunity-engine/lib/scoring";
import type {
  EngineBusinessRef,
  EngineData,
  EngineOpportunity,
  EngineStats,
} from "@/features/opportunity-engine/types";

type OppRow = Prisma.AiOpportunityGetPayload<{
  include: {
    analysis: { select: { placeId: true; businessName: true; summary: true } };
    mvpSpec: { select: { id: true; pricing: { select: { id: true } }; proposal: { select: { id: true } } } };
  };
}>;

function toEngineOpportunity(row: OppRow): EngineOpportunity {
  const impact = (row.impact as OppLevel | null) ?? null;
  const effort = (row.effort as OppLevel | null) ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    development: row.development,
    impact,
    effort,
    selected: row.selected,
    hasSpec: row.mvpSpec !== null,
    hasPricing: row.mvpSpec?.pricing != null,
    hasProposal: row.mvpSpec?.proposal != null,
    placeId: row.analysis.placeId,
    businessName: row.analysis.businessName,
    analysisSummary: row.analysis.summary,
    createdAt: row.createdAt.toISOString(),
    score: priorityScore(impact, effort),
    quadrant: quadrantOf(impact, effort),
  };
}

/** Loads every opportunity, sorted by priority score (highest first), with stats. */
export async function getEngineData(): Promise<EngineData> {
  const rows = await prisma.aiOpportunity.findMany({
    where: { analysis: { archivedAt: null } },
    orderBy: { createdAt: "desc" },
    include: {
      analysis: { select: { placeId: true, businessName: true, summary: true } },
      mvpSpec: {
        select: { id: true, pricing: { select: { id: true } }, proposal: { select: { id: true } } },
      },
    },
  });

  const opportunities = rows.map(toEngineOpportunity).sort((a, b) => b.score - a.score);

  const stats: EngineStats = {
    total: opportunities.length,
    selected: opportunities.filter((o) => o.selected).length,
    withSpec: opportunities.filter((o) => o.hasSpec).length,
    quickWins: opportunities.filter((o) => o.quadrant === "quick-win").length,
    pending: opportunities.filter((o) => !o.selected).length,
  };

  // Distinct businesses (for the filter dropdown), sorted by opportunity count.
  const byBusiness = new Map<string, EngineBusinessRef>();
  for (const o of opportunities) {
    const ref = byBusiness.get(o.placeId);
    if (ref) ref.count += 1;
    else byBusiness.set(o.placeId, { placeId: o.placeId, businessName: o.businessName, count: 1 });
  }
  const businesses = [...byBusiness.values()].sort(
    (a, b) => b.count - a.count || a.businessName.localeCompare(b.businessName)
  );

  return { opportunities, stats, businesses };
}
