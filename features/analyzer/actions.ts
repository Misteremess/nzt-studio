"use server";
// features/analyzer/actions.ts
// Server Actions for the AI Business Analyzer.
// All Claude API access and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { analyzeBusiness, AnalysisParseError } from "@/features/analyzer/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  getBusinessContext,
  getAnalysisByPlaceId,
  listAnalyses,
  saveAnalysis,
  setOpportunitySelected,
  archiveAnalysis,
  restoreAnalysis,
  deleteAnalysis,
} from "@/features/analyzer/lib/analysis-store";
import type { AnalysisListItem, BusinessAnalysisData } from "@/features/analyzer/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/**
 * Runs (or re-runs) the AI analysis for a business identified by placeId.
 * The business must already exist in PlaceCache (discovered via the Rastreador).
 */
export async function analyzeBusinessAction(
  placeId: string
): Promise<ActionResult<BusinessAnalysisData>> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Place ID no válido.", errorCode: "INVALID_INPUT" };
  }

  let ctx;
  try {
    ctx = await getBusinessContext(placeId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!ctx) {
    return {
      ok: false,
      error: "Negocio no encontrado. Selecciónalo primero en el Rastreador.",
      errorCode: "NOT_FOUND",
    };
  }

  try {
    const { output, raw, model } = await analyzeBusiness(ctx);
    const saved = await saveAnalysis(ctx, output, model, raw);
    revalidatePath(`/analyzer`);
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof AnalysisParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Analyzer", "Error inesperado al analizar.");
  }
}

/** Returns all stored analyses (compact) for the Analyzer landing listing. */
export async function listAnalysesAction(includeArchived = false): Promise<ActionResult<AnalysisListItem[]>> {
  try {
    const analyses = await listAnalyses(includeArchived);
    return { ok: true, data: analyses };
  } catch {
    return { ok: false, error: "Error al cargar los análisis.", errorCode: "DB_ERROR" };
  }
}

/** Archives a BusinessAnalysis so it's hidden from all modules and analytics. */
export async function archiveAnalysisAction(placeId: string): Promise<ActionResult<void>> {
  if (!placeId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveAnalysis(placeId);
    revalidatePath("/analyzer");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived BusinessAnalysis. */
export async function restoreAnalysisAction(placeId: string): Promise<ActionResult<void>> {
  if (!placeId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreAnalysis(placeId);
    revalidatePath("/analyzer");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a BusinessAnalysis and all cascaded AI records. */
export async function deleteAnalysisAction(placeId: string): Promise<ActionResult<void>> {
  if (!placeId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteAnalysis(placeId);
    revalidatePath("/analyzer");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Returns the stored analysis for a business, or null if none exists yet. */
export async function getAnalysisAction(
  placeId: string
): Promise<ActionResult<BusinessAnalysisData | null>> {
  try {
    const analysis = await getAnalysisByPlaceId(placeId);
    return { ok: true, data: analysis };
  } catch {
    return { ok: false, error: "Error al cargar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Marks/unmarks an opportunity for inclusion in the MVP Factory. */
export async function toggleOpportunityAction(
  opportunityId: string,
  selected: boolean
): Promise<ActionResult<{ id: string; selected: boolean }>> {
  if (!opportunityId) {
    return { ok: false, error: "Oportunidad no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await setOpportunitySelected(opportunityId, selected);
    revalidatePath(`/analyzer`);
    return { ok: true, data: { id: opportunityId, selected } };
  } catch {
    return { ok: false, error: "No se pudo actualizar la oportunidad.", errorCode: "DB_ERROR" };
  }
}
