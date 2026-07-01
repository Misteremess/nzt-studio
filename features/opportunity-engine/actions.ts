"use server";
// features/opportunity-engine/actions.ts
// Server Actions for the Opportunity Engine. Reads aggregate opportunity data
// and lets the user (de)select an opportunity for the MVP Factory — the same
// `selected` flag the Analyzer toggles, surfaced from a cross-business board.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { setOpportunitySelected } from "@/features/analyzer/lib/analysis-store";
import { getEngineData } from "@/features/opportunity-engine/lib/store";
import type { EngineData } from "@/features/opportunity-engine/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Returns the full prioritized opportunity board. */
export async function listOpportunitiesAction(): Promise<ActionResult<EngineData>> {
  try {
    const data = await getEngineData();
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Error al cargar las oportunidades.", errorCode: "DB_ERROR" };
  }
}

/** Marks/unmarks an opportunity for the MVP Factory. */
export async function setOpportunitySelectedAction(
  opportunityId: string,
  selected: boolean
): Promise<ActionResult<{ id: string; selected: boolean }>> {
  if (!opportunityId || typeof opportunityId !== "string") {
    return { ok: false, error: "Oportunidad no válida.", errorCode: "INVALID_INPUT" };
  }
  try {
    await setOpportunitySelected(opportunityId, selected);
    // Selection drives the Analyzer, MVP Factory and this board.
    revalidatePath("/opportunity-engine");
    revalidatePath("/mvp-factory");
    revalidatePath("/analyzer");
    return { ok: true, data: { id: opportunityId, selected } };
  } catch {
    return { ok: false, error: "No se pudo actualizar la oportunidad.", errorCode: "DB_ERROR" };
  }
}
