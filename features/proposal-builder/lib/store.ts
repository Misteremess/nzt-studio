// features/proposal-builder/lib/store.ts
// Server-only Prisma helpers for the Proposal Builder.
// Reads MVP specs (with pricing) generated upstream and persists the
// AiProposal records (1:1 per MVP spec).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { Complexity } from "@/features/mvp-factory/types";
import type {
  ProposalBusiness,
  ProposalData,
  ProposalInput,
  ProposalOutput,
  ProposalPhase,
  ProposalPricingContext,
  ProposalPricingTier,
} from "@/features/proposal-builder/types";

// ─── Read the proposal inbox ──────────────────────────────────────────────────

/**
 * Lists businesses that have at least one generated MVP spec, grouped, with
 * each MVP's proposal (if any). Most recently updated first.
 */
export async function listProposalBusinesses(includeArchived = false): Promise<ProposalBusiness[]> {
  const rows = await prisma.businessAnalysis.findMany({
    where: {
      archivedAt: null,
      opportunities: { some: { mvpSpec: { is: { archivedAt: null } } } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      placeId: true,
      businessName: true,
      summary: true,
      opportunities: {
        where: { mvpSpec: { is: { archivedAt: null } } },
        orderBy: { createdAt: "asc" },
        select: {
          title: true,
          mvpSpec: { include: { pricing: true, proposal: true } },
        },
      },
    },
  });

  return rows
    .map((r) => ({
      placeId: r.placeId,
      businessName: r.businessName,
      summary: r.summary,
      items: r.opportunities
        .filter((o) => o.mvpSpec)
        .map((o) => {
          const spec = o.mvpSpec!;
          const pr = spec.proposal;
          // Active mode: show active proposal or no proposal. Archived mode: show only archived proposals.
          const proposal = pr
            ? includeArchived
              ? pr.archivedAt !== null
                ? toProposalData(pr)
                : null
              : pr.archivedAt === null
                ? toProposalData(pr)
                : null
            : null;
          if (includeArchived && proposal === null) return null;
          return {
            mvpSpecId: spec.id,
            opportunityTitle: o.title,
            pitch: spec.pitch,
            timeline: spec.timeline,
            complexity: (spec.complexity as Complexity | null) ?? null,
            hasPricing: spec.pricing != null && spec.pricing.archivedAt === null,
            proposal,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    }))
    .filter((b) => b.items.length > 0);
}

/** Builds the AI proposal context for an MVP spec, or null if not found. */
export async function getProposalInput(mvpSpecId: string): Promise<ProposalInput | null> {
  const spec = await prisma.aiMvpSpec.findUnique({
    where: { id: mvpSpecId },
    include: {
      pricing: true,
      opportunity: {
        include: { analysis: { select: { businessName: true, summary: true } } },
      },
    },
  });
  if (!spec) return null;

  return {
    businessName: spec.opportunity.analysis.businessName,
    businessSummary: spec.opportunity.analysis.summary,
    opportunityTitle: spec.opportunity.title,
    pitch: spec.pitch,
    problem: spec.problem,
    solution: spec.solution,
    targetUser: spec.targetUser,
    coreFeatures: toStringArray(spec.coreFeatures),
    futureFeatures: toStringArray(spec.futureFeatures),
    techStack: toStringArray(spec.techStack),
    timeline: spec.timeline,
    complexity: (spec.complexity as Complexity | null) ?? null,
    pricing: spec.pricing ? toPricingContext(spec.pricing) : null,
  };
}

export async function getProposal(mvpSpecId: string): Promise<ProposalData | null> {
  const row = await prisma.aiProposal.findUnique({ where: { mvpSpecId } });
  return row ? toProposalData(row) : null;
}

// ─── Write ──────────────────────────────────────────────────────────────────

/** Persists (or replaces) the generated proposal for an MVP spec. */
export async function saveProposal(
  mvpSpecId: string,
  output: ProposalOutput,
  model: string,
  raw: unknown
): Promise<ProposalData> {
  const data = {
    model,
    title: output.title,
    executiveSummary: output.executiveSummary,
    problemStatement: output.problemStatement,
    proposedSolution: output.proposedSolution,
    scope: output.scope as unknown as Prisma.InputJsonValue,
    outOfScope: output.outOfScope as unknown as Prisma.InputJsonValue,
    deliverables: output.deliverables as unknown as Prisma.InputJsonValue,
    phases: output.phases as unknown as Prisma.InputJsonValue,
    terms: output.terms as unknown as Prisma.InputJsonValue,
    nextSteps: output.nextSteps as unknown as Prisma.InputJsonValue,
    investment: output.investment,
    callToAction: output.callToAction,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };

  const row = await prisma.aiProposal.upsert({
    where: { mvpSpecId },
    create: { mvpSpecId, ...data },
    update: data,
  });
  return toProposalData(row);
}

/** Archives an AiProposal record. */
export async function archiveProposal(proposalId: string): Promise<void> {
  await prisma.aiProposal.update({ where: { id: proposalId }, data: { archivedAt: new Date() } });
}

/** Restores an archived AiProposal record. */
export async function restoreProposal(proposalId: string): Promise<void> {
  await prisma.aiProposal.update({ where: { id: proposalId }, data: { archivedAt: null } });
}

/** Permanently deletes an AiProposal record. */
export async function deleteProposal(proposalId: string): Promise<void> {
  await prisma.aiProposal.delete({ where: { id: proposalId } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type ProposalRow = Prisma.AiProposalGetPayload<object>;
type PricingRow = Prisma.AiPricingGetPayload<object>;

function toProposalData(row: ProposalRow): ProposalData {
  return {
    id: row.id,
    mvpSpecId: row.mvpSpecId,
    model: row.model,
    title: row.title,
    executiveSummary: row.executiveSummary,
    problemStatement: row.problemStatement,
    proposedSolution: row.proposedSolution,
    scope: toStringArray(row.scope),
    outOfScope: toStringArray(row.outOfScope),
    deliverables: toStringArray(row.deliverables),
    phases: toPhases(row.phases),
    terms: toStringArray(row.terms),
    nextSteps: toStringArray(row.nextSteps),
    investment: row.investment,
    callToAction: row.callToAction,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPricingContext(row: PricingRow): ProposalPricingContext {
  return {
    currency: row.currency,
    setupPrice: row.setupPrice,
    monthlyPrice: row.monthlyPrice,
    tiers: toPricingTiers(row.tiers),
    recommendedTier: row.recommendedTier,
    paymentTerms: row.paymentTerms,
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toPhases(value: Prisma.JsonValue): ProposalPhase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p) => {
      if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
      const r = p as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const description = typeof r.description === "string" ? r.description : "";
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((p): p is ProposalPhase => p !== null);
}

function toPricingTiers(value: Prisma.JsonValue): ProposalPricingTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => {
      if (typeof t !== "object" || t === null || Array.isArray(t)) return null;
      const r = t as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      if (!name) return null;
      return {
        name,
        price: typeof r.price === "number" ? r.price : 0,
        billing: typeof r.billing === "string" ? r.billing : "one-time",
        description: typeof r.description === "string" ? r.description : "",
        features: Array.isArray(r.features)
          ? r.features.filter((f): f is string => typeof f === "string")
          : [],
      };
    })
    .filter((t): t is ProposalPricingTier => t !== null);
}
