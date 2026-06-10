// features/pricing-studio/lib/store.ts
// Server-only Prisma helpers for the Pricing Studio.
// Reads MVP specs generated in the MVP Factory and persists the AiPricing
// records (1:1 per MVP spec).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { Complexity } from "@/features/mvp-factory/types";
import type {
  PricingBusiness,
  PricingData,
  PricingInput,
  PricingOutput,
  PricingTier,
  SaasModel,
} from "@/features/pricing-studio/types";

// ─── Read the pricing inbox ───────────────────────────────────────────────────

/**
 * Lists businesses that have at least one generated MVP spec, grouped, with
 * each MVP's pricing (if any). Most recently updated first.
 */
export async function listPricingBusinesses(includeArchived = false): Promise<PricingBusiness[]> {
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
          mvpSpec: { include: { pricing: true } },
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
          const p = spec.pricing;
          // Active mode: show active pricing or no pricing. Archived mode: show only archived pricing.
          const pricing = p
            ? includeArchived
              ? p.archivedAt !== null
                ? toPricingData(p)
                : null
              : p.archivedAt === null
                ? toPricingData(p)
                : null
            : null;
          if (includeArchived && pricing === null) return null;
          return {
            mvpSpecId: spec.id,
            opportunityTitle: o.title,
            pitch: spec.pitch,
            timeline: spec.timeline,
            complexity: (spec.complexity as Complexity | null) ?? null,
            pricing,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    }))
    .filter((b) => b.items.length > 0);
}

/** Builds the AI pricing context for an MVP spec, or null if not found. */
export async function getPricingInput(mvpSpecId: string): Promise<PricingInput | null> {
  const spec = await prisma.aiMvpSpec.findUnique({
    where: { id: mvpSpecId },
    include: {
      opportunity: { include: { analysis: { select: { businessName: true, summary: true } } } },
    },
  });
  if (!spec) return null;

  return {
    businessName: spec.opportunity.analysis.businessName,
    businessSummary: spec.opportunity.analysis.summary,
    pitch: spec.pitch,
    solution: spec.solution,
    targetUser: spec.targetUser,
    coreFeatures: toStringArray(spec.coreFeatures),
    techStack: toStringArray(spec.techStack),
    timeline: spec.timeline,
    complexity: (spec.complexity as Complexity | null) ?? null,
  };
}

export async function getPricing(mvpSpecId: string): Promise<PricingData | null> {
  const row = await prisma.aiPricing.findUnique({ where: { mvpSpecId } });
  return row ? toPricingData(row) : null;
}

// ─── Write ──────────────────────────────────────────────────────────────────

/** Persists (or replaces) the generated pricing for an MVP spec. */
export async function savePricing(
  mvpSpecId: string,
  output: PricingOutput,
  model: string,
  raw: unknown
): Promise<PricingData> {
  const data = {
    model,
    currency: output.currency,
    setupPrice: output.setupPrice,
    monthlyPrice: output.monthlyPrice,
    tiers: output.tiers as unknown as Prisma.InputJsonValue,
    recommendedTier: output.recommendedTier,
    paymentTerms: output.paymentTerms,
    rationale: output.rationale,
    assumptions: output.assumptions as unknown as Prisma.InputJsonValue,
    saasModel: (output.saasModel ?? null) as unknown as Prisma.InputJsonValue,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };

  const row = await prisma.aiPricing.upsert({
    where: { mvpSpecId },
    create: { mvpSpecId, ...data },
    update: data,
  });
  return toPricingData(row);
}

/** Archives an AiPricing record. */
export async function archivePricing(pricingId: string): Promise<void> {
  await prisma.aiPricing.update({ where: { id: pricingId }, data: { archivedAt: new Date() } });
}

/** Restores an archived AiPricing record. */
export async function restorePricing(pricingId: string): Promise<void> {
  await prisma.aiPricing.update({ where: { id: pricingId }, data: { archivedAt: null } });
}

/** Permanently deletes an AiPricing record. */
export async function deletePricing(pricingId: string): Promise<void> {
  await prisma.aiPricing.delete({ where: { id: pricingId } });
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type PricingRow = Prisma.AiPricingGetPayload<object>;

function toPricingData(row: PricingRow): PricingData {
  return {
    id: row.id,
    mvpSpecId: row.mvpSpecId,
    model: row.model,
    currency: row.currency,
    setupPrice: row.setupPrice,
    monthlyPrice: row.monthlyPrice,
    tiers: toTiers(row.tiers),
    recommendedTier: row.recommendedTier,
    paymentTerms: row.paymentTerms,
    rationale: row.rationale,
    assumptions: toStringArray(row.assumptions),
    saasModel: toSaasModel(row.saasModel),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSaasModel(value: Prisma.JsonValue): SaasModel | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const monthlyPrice = typeof r.monthlyPrice === "number" ? r.monthlyPrice : 0;
  if (monthlyPrice <= 0) return null;
  const num = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null);
  return {
    monthlyPrice,
    annualPrice: num(r.annualPrice),
    setupFee: num(r.setupFee),
    minimumTermMonths: num(r.minimumTermMonths),
    includedServices: Array.isArray(r.includedServices)
      ? r.includedServices.filter((s): s is string => typeof s === "string")
      : [],
    breakEvenMonths: num(r.breakEvenMonths),
    rationale: typeof r.rationale === "string" ? r.rationale : "",
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toTiers(value: Prisma.JsonValue): PricingTier[] {
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
    .filter((t): t is PricingTier => t !== null);
}
