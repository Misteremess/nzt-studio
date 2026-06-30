"use server";
// features/content-seo/actions.ts
// Server Actions for the Content/SEO Agent.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { ContentSeoParseError, generateContentPlan, generateSeoReport } from "@/features/content-seo/lib/claude";
import { runSeoPageAudit } from "@/features/content-seo/lib/seo-audit-fetch";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  archiveSeoAudit,
  createSeoAudit,
  deleteSeoAudit,
  getContentPlan,
  listContentPlanCandidates,
  listContentPlans,
  listSeoAuditCandidates,
  listSeoAudits,
  restoreSeoAudit,
  upsertContentPlan,
} from "@/features/content-seo/lib/store";
import type { ContentPlanCandidate, ContentPlanData, SeoAuditCandidate, SeoAuditData } from "@/features/content-seo/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function refresh() {
  revalidatePath("/content-seo");
}

/** Lists analyzed businesses eligible for a content plan. */
export async function listContentPlanCandidatesAction(): Promise<ActionResult<ContentPlanCandidate[]>> {
  try {
    const candidates = await listContentPlanCandidates();
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Error al cargar los negocios disponibles.", errorCode: "DB_ERROR" };
  }
}

/** Lists generated content plans. */
export async function listContentPlansAction(): Promise<ActionResult<ContentPlanData[]>> {
  try {
    const plans = await listContentPlans();
    return { ok: true, data: plans };
  } catch {
    return { ok: false, error: "Error al cargar los planes de contenido.", errorCode: "DB_ERROR" };
  }
}

/** Gets the content plan for a business, if any. */
export async function getContentPlanAction(placeId: string): Promise<ActionResult<ContentPlanData | null>> {
  try {
    const plan = await getContentPlan(placeId);
    return { ok: true, data: plan };
  } catch {
    return { ok: false, error: "Error al cargar el plan de contenido.", errorCode: "DB_ERROR" };
  }
}

/** Generates (or regenerates) the content plan for the given business. */
export async function generateContentPlanAction(candidate: ContentPlanCandidate): Promise<ActionResult<ContentPlanData>> {
  if (!candidate?.placeId || !candidate?.businessName) {
    return { ok: false, error: "Selecciona un negocio.", errorCode: "INVALID_INPUT" };
  }

  try {
    const { output, raw, model } = await generateContentPlan({
      placeId: candidate.placeId,
      businessName: candidate.businessName,
      primaryType: candidate.primaryType,
      summary: candidate.summary,
      seoIssues: candidate.seoIssues,
    });
    const saved = await upsertContentPlan({ placeId: candidate.placeId, businessName: candidate.businessName }, output, model, raw);
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof ContentSeoParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Content/SEO Agent", "Error inesperado al generar el plan de contenido.");
  }
}

// ─── SEO Audit (URL-based) ──────────────────────────────────────────────────

const URL_PATTERN = /^https?:\/\/.+/i;

/** Lists businesses with a known website — alternative input source for SEO audits. */
export async function listSeoAuditCandidatesAction(): Promise<ActionResult<SeoAuditCandidate[]>> {
  try {
    const candidates = await listSeoAuditCandidates();
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Error al cargar los negocios disponibles.", errorCode: "DB_ERROR" };
  }
}

/** Lists past SEO audits. */
export async function listSeoAuditsAction(includeArchived = false): Promise<ActionResult<SeoAuditData[]>> {
  try {
    const audits = await listSeoAudits(includeArchived);
    return { ok: true, data: audits };
  } catch {
    return { ok: false, error: "Error al cargar las auditorías SEO.", errorCode: "DB_ERROR" };
  }
}

/** Runs a full technical fetch + AI SEO audit for the given URL. */
export async function runSeoAuditAction(input: { url: string; businessName?: string | null }): Promise<ActionResult<SeoAuditData>> {
  const url = input.url?.trim();
  if (!url) {
    return { ok: false, error: "Indica una URL a analizar.", errorCode: "INVALID_INPUT" };
  }
  const normalized = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
  if (!URL_PATTERN.test(normalized)) {
    return { ok: false, error: "La URL no parece válida.", errorCode: "INVALID_INPUT" };
  }

  try {
    const technical = await runSeoPageAudit(normalized);
    if (!technical.reachable) {
      return {
        ok: false,
        error: "No se pudo acceder a la URL indicada. Comprueba que es correcta y accesible públicamente.",
        errorCode: "UNREACHABLE",
      };
    }

    const businessName = input.businessName?.trim() || null;
    const { output, raw, model } = await generateSeoReport({ url: normalized, businessName, technical });
    const saved = await createSeoAudit({ url: normalized, businessName, technical, report: output, model, raw });
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof ContentSeoParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Content/SEO Agent", "Error inesperado al generar la auditoría SEO.");
  }
}

/** Archives a SEO audit. */
export async function archiveSeoAuditAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Auditoría no válida.", errorCode: "INVALID_INPUT" };
  try {
    await archiveSeoAudit(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar la auditoría.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived SEO audit. */
export async function restoreSeoAuditAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Auditoría no válida.", errorCode: "INVALID_INPUT" };
  try {
    await restoreSeoAudit(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar la auditoría.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a SEO audit. */
export async function deleteSeoAuditAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Auditoría no válida.", errorCode: "INVALID_INPUT" };
  try {
    await deleteSeoAudit(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar la auditoría.", errorCode: "DB_ERROR" };
  }
}
