// features/mvp-factory/lib/spec-store.ts
// Server-only Prisma helpers for the MVP Factory.
// Reads opportunities marked "→ MVP Factory" (AiOpportunity.selected = true)
// and persists the generated AiMvpSpec records (1:1 per opportunity).
import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import type { OppLevel } from "@/features/analyzer/types";
import type {
  BrandIdentityData,
  BrandIdentityInput,
  Complexity,
  FactoryBusiness,
  MvpPhase,
  MvpSpecData,
  MvpSpecInput,
  MvpSpecOutput,
  StoredMvpImage,
} from "@/features/mvp-factory/types";

/** Stable display order + sort key for the three mockup kinds. */
const IMAGE_KIND_ORDER: Record<string, number> = { hero: 0, features: 1, detail: 2 };

// ─── Read the factory inbox ───────────────────────────────────────────────────

/**
 * Lists businesses that have at least one selected opportunity, grouped, with
 * each opportunity's generated spec (if any). Most recently updated first.
 */
export async function listFactoryBusinesses(includeArchived = false): Promise<FactoryBusiness[]> {
  // Archived view: only opportunities with an archived spec.
  // Default view: opportunities with no spec yet (just selected) or a non-archived spec.
  const opportunityFilter = includeArchived
    ? { selected: true, mvpSpec: { is: { archivedAt: { not: null } } } }
    : { selected: true, OR: [{ mvpSpec: null }, { mvpSpec: { is: { archivedAt: null } } }] };

  const rows = await prisma.businessAnalysis.findMany({
    where: {
      archivedAt: null,
      opportunities: { some: opportunityFilter },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      placeId: true,
      businessName: true,
      summary: true,
      brandIdentity: true,
      opportunities: {
        where: opportunityFilter,
        orderBy: { createdAt: "asc" },
        include: { mvpSpec: { include: { images: true } } },
      },
    },
  });

  const websiteByPlaceId = await getWebsitesByPlaceId(rows.map((r) => r.placeId));

  return rows.map((r) => ({
    placeId: r.placeId,
    businessName: r.businessName,
    summary: r.summary,
    websiteUri: websiteByPlaceId.get(r.placeId) ?? null,
    brandIdentity: r.brandIdentity ? toBrandIdentityData(r.brandIdentity) : null,
    opportunities: r.opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      development: o.development,
      impact: (o.impact as OppLevel | null) ?? null,
      effort: (o.effort as OppLevel | null) ?? null,
      spec: o.mvpSpec ? toSpecData(o.mvpSpec) : null,
      images: o.mvpSpec ? toStoredImages(o.mvpSpec.images) : [],
    })),
  }));
}

/** Looks up PlaceCache.websiteUri for a batch of placeIds. */
async function getWebsitesByPlaceId(placeIds: string[]): Promise<Map<string, string | null>> {
  if (placeIds.length === 0) return new Map();
  const rows = await prisma.placeCache.findMany({
    where: { placeId: { in: placeIds } },
    select: { placeId: true, websiteUri: true },
  });
  return new Map(rows.map((r) => [r.placeId, r.websiteUri]));
}

/** Builds the AI generation context for an opportunity, or null if not found. */
export async function getOpportunityForSpec(
  opportunityId: string
): Promise<MvpSpecInput | null> {
  const row = await prisma.aiOpportunity.findUnique({
    where: { id: opportunityId },
    include: {
      analysis: {
        select: { businessName: true, summary: true, assets: true, webFindings: true, brandIdentity: true },
      },
    },
  });
  if (!row) return null;

  return {
    businessName: row.analysis.businessName,
    businessSummary: row.analysis.summary,
    businessAssets: toStringArray(row.analysis.assets),
    businessWebFindings: toWebFindingsText(row.analysis.webFindings),
    opportunityTitle: row.title,
    opportunityDescription: row.description,
    opportunityDevelopment: row.development,
    impact: (row.impact as OppLevel | null) ?? null,
    effort: (row.effort as OppLevel | null) ?? null,
    brandIdentity: row.analysis.brandIdentity ? toBrandIdentityData(row.analysis.brandIdentity) : null,
  };
}

/** Extracts the free-text research from a BusinessAnalysis.webFindings JSON, capped for prompt size. */
function toWebFindingsText(value: Prisma.JsonValue): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const text = (value as Record<string, unknown>).text;
  if (typeof text !== "string") return "";
  return text.length > 3000 ? `${text.slice(0, 3000)}…` : text;
}

export async function getMvpSpec(opportunityId: string): Promise<MvpSpecData | null> {
  const row = await prisma.aiMvpSpec.findUnique({ where: { opportunityId } });
  return row ? toSpecData(row) : null;
}

// ─── Brand identity ─────────────────────────────────────────────────────────

/** Reads the business website detected by the Rastreador (Google Places), if any. */
export async function getWebsiteForPlace(placeId: string): Promise<string | null> {
  const row = await prisma.placeCache.findUnique({
    where: { placeId },
    select: { websiteUri: true },
  });
  return row?.websiteUri ?? null;
}

/** Reads the brand identity for a business (by placeId), or null if not configured. */
export async function getBrandIdentity(placeId: string): Promise<BrandIdentityData | null> {
  const analysis = await prisma.businessAnalysis.findUnique({
    where: { placeId },
    select: { brandIdentity: true },
  });
  return analysis?.brandIdentity ? toBrandIdentityData(analysis.brandIdentity) : null;
}

/** Persists (or replaces) the brand identity for a business (by placeId). */
export async function saveBrandIdentity(
  placeId: string,
  data: BrandIdentityInput
): Promise<BrandIdentityData> {
  const analysis = await prisma.businessAnalysis.findUnique({
    where: { placeId },
    select: { id: true },
  });
  if (!analysis) throw new Error("Negocio no encontrado.");

  const payload = {
    source: data.source,
    sourceUrl: data.sourceUrl ?? null,
    colors: data.colors as unknown as Prisma.InputJsonValue,
    fontHeading: data.fontHeading ?? null,
    fontBody: data.fontBody ?? null,
    styleNotes: data.styleNotes ?? null,
    logoImage: data.logoImage ?? null,
    logoImageMime: data.logoImageMime ?? null,
    referenceImage: data.referenceImage ?? null,
    referenceImageMime: data.referenceImageMime ?? null,
    model: data.model ?? null,
  };

  const row = await prisma.brandIdentity.upsert({
    where: { analysisId: analysis.id },
    create: { analysisId: analysis.id, ...payload },
    update: payload,
  });
  return toBrandIdentityData(row);
}

// ─── Write ──────────────────────────────────────────────────────────────────

/** Persists (or replaces) the generated spec for an opportunity. */
export async function saveMvpSpec(
  opportunityId: string,
  output: MvpSpecOutput,
  model: string,
  raw: unknown
): Promise<MvpSpecData> {
  const data = {
    model,
    pitch: output.pitch,
    problem: output.problem,
    solution: output.solution,
    targetUser: output.targetUser,
    coreFeatures: output.coreFeatures as unknown as Prisma.InputJsonValue,
    futureFeatures: output.futureFeatures as unknown as Prisma.InputJsonValue,
    techStack: output.techStack as unknown as Prisma.InputJsonValue,
    phases: output.phases as unknown as Prisma.InputJsonValue,
    timeline: output.timeline,
    complexity: output.complexity,
    rawOutput: (raw ?? null) as Prisma.InputJsonValue,
  };

  const row = await prisma.aiMvpSpec.upsert({
    where: { opportunityId },
    create: { opportunityId, ...data },
    update: data,
  });
  return toSpecData(row);
}

/** Persists the AI-generated HTML landing mockup for an opportunity's spec. */
export async function saveMvpHtmlMockup(
  opportunityId: string,
  html: string,
  model: string
): Promise<MvpSpecData | null> {
  const spec = await prisma.aiMvpSpec.findUnique({ where: { opportunityId } });
  if (!spec) return null;

  const row = await prisma.aiMvpSpec.update({
    where: { opportunityId },
    data: { htmlMockup: html, htmlMockupModel: model },
  });
  return toSpecData(row);
}

/** Archives an AiMvpSpec (hides spec + downstream pricing/proposal/delivery). */
export async function archiveMvpSpec(specId: string): Promise<void> {
  await prisma.aiMvpSpec.update({ where: { id: specId }, data: { archivedAt: new Date() } });
}

/** Restores an archived AiMvpSpec. */
export async function restoreMvpSpec(specId: string): Promise<void> {
  await prisma.aiMvpSpec.update({ where: { id: specId }, data: { archivedAt: null } });
}

/** Permanently deletes an AiMvpSpec (cascades to AiPricing, AiProposal, AiMvpImage). */
export async function deleteMvpSpec(specId: string): Promise<void> {
  await prisma.aiMvpSpec.delete({ where: { id: specId } });
}

// ─── Design images ────────────────────────────────────────────────────────────

/** Reads the persisted design mockups for an opportunity's spec. */
export async function getMvpImages(opportunityId: string): Promise<StoredMvpImage[]> {
  const spec = await prisma.aiMvpSpec.findUnique({
    where: { opportunityId },
    select: { images: true },
  });
  return spec ? toStoredImages(spec.images) : [];
}

/**
 * Persists (replacing any previous set) the generated design mockups for an
 * opportunity's spec. Upserts per kind so regenerating overwrites in place.
 * Returns null if the opportunity has no spec yet.
 */
export async function saveMvpImages(
  opportunityId: string,
  images: { id: string; label: string; b64: string }[],
  model: string
): Promise<StoredMvpImage[] | null> {
  const spec = await prisma.aiMvpSpec.findUnique({
    where: { opportunityId },
    select: { id: true },
  });
  if (!spec) return null;

  // Each image is a ~2MB base64 string; writing all three inside a single
  // interactive transaction blows past Prisma's 5s transaction timeout (P2028)
  // over a remote SSL connection. Upsert them sequentially instead — each is its
  // own short statement, no shared transaction window.
  for (const img of images) {
    await prisma.aiMvpImage.upsert({
      where: { mvpSpecId_kind: { mvpSpecId: spec.id, kind: img.id } },
      create: { mvpSpecId: spec.id, kind: img.id, label: img.label, data: img.b64, model },
      update: { label: img.label, data: img.b64, model },
    });
  }

  return getMvpImages(opportunityId);
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

type SpecRow = Prisma.AiMvpSpecGetPayload<object>;
type ImageRow = Prisma.AiMvpImageGetPayload<object>;
type BrandIdentityRow = Prisma.BrandIdentityGetPayload<object>;

function toBrandIdentityData(row: BrandIdentityRow): BrandIdentityData {
  return {
    source: (row.source as BrandIdentityData["source"]) ?? "manual",
    sourceUrl: row.sourceUrl,
    colors: toBrandColors(row.colors),
    fontHeading: row.fontHeading,
    fontBody: row.fontBody,
    styleNotes: row.styleNotes,
    logoImage: row.logoImage,
    logoImageMime: row.logoImageMime,
    referenceImage: row.referenceImage,
    referenceImageMime: row.referenceImageMime,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toBrandColors(value: Prisma.JsonValue): BrandIdentityData["colors"] {
  if (!Array.isArray(value)) return [];
  const colors: BrandIdentityData["colors"] = [];
  for (const c of value) {
    if (typeof c !== "object" || c === null || Array.isArray(c)) continue;
    const r = c as Record<string, unknown>;
    const role = typeof r.role === "string" ? r.role : "";
    const hex = typeof r.hex === "string" ? r.hex : "";
    if (!role || !hex) continue;
    const label = typeof r.label === "string" ? r.label : undefined;
    colors.push(label ? { role, hex, label } : { role, hex });
  }
  return colors;
}

function toStoredImages(rows: ImageRow[]): StoredMvpImage[] {
  return rows
    .filter((r): r is ImageRow & { kind: StoredMvpImage["id"] } =>
      r.kind === "hero" || r.kind === "features" || r.kind === "detail"
    )
    .sort((a, b) => (IMAGE_KIND_ORDER[a.kind] ?? 9) - (IMAGE_KIND_ORDER[b.kind] ?? 9))
    .map((r) => ({ id: r.kind, label: r.label, b64: r.data }));
}

function toSpecData(row: SpecRow): MvpSpecData {
  return {
    id: row.id,
    opportunityId: row.opportunityId,
    model: row.model,
    pitch: row.pitch,
    problem: row.problem,
    solution: row.solution,
    targetUser: row.targetUser,
    coreFeatures: toStringArray(row.coreFeatures),
    futureFeatures: toStringArray(row.futureFeatures),
    techStack: toStringArray(row.techStack),
    phases: toPhases(row.phases),
    timeline: row.timeline,
    complexity: (row.complexity as Complexity | null) ?? null,
    htmlMockup: row.htmlMockup ?? null,
    htmlMockupModel: row.htmlMockupModel ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toPhases(value: Prisma.JsonValue): MvpPhase[] {
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
    .filter((p): p is MvpPhase => p !== null);
}
