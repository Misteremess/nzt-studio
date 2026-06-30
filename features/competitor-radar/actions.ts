"use server";
// features/competitor-radar/actions.ts
// Server Actions for the Competitor Radar.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { CompetitorRadarParseError, runCompetitorRadar } from "@/features/competitor-radar/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  getCompetitorRadarReport,
  listCompetitorRadarCandidates,
  listCompetitorRadarReports,
  upsertCompetitorRadarReport,
} from "@/features/competitor-radar/lib/store";
import type { CompetitorRadarCandidate, CompetitorRadarReportData } from "@/features/competitor-radar/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function refresh() {
  revalidatePath("/competitor-radar");
}

/** Lists analyzed businesses eligible for a competitor radar report. */
export async function listCompetitorRadarCandidatesAction(): Promise<ActionResult<CompetitorRadarCandidate[]>> {
  try {
    const candidates = await listCompetitorRadarCandidates();
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Error al cargar los negocios disponibles.", errorCode: "DB_ERROR" };
  }
}

/** Lists generated competitor radar reports. */
export async function listCompetitorRadarReportsAction(): Promise<ActionResult<CompetitorRadarReportData[]>> {
  try {
    const reports = await listCompetitorRadarReports();
    return { ok: true, data: reports };
  } catch {
    return { ok: false, error: "Error al cargar los informes.", errorCode: "DB_ERROR" };
  }
}

/** Gets the competitor radar report for a business, if any. */
export async function getCompetitorRadarReportAction(placeId: string): Promise<ActionResult<CompetitorRadarReportData | null>> {
  try {
    const report = await getCompetitorRadarReport(placeId);
    return { ok: true, data: report };
  } catch {
    return { ok: false, error: "Error al cargar el informe.", errorCode: "DB_ERROR" };
  }
}

/** Runs (or re-runs) the competitor radar for the given business. */
export async function runCompetitorRadarAction(candidate: CompetitorRadarCandidate): Promise<ActionResult<CompetitorRadarReportData>> {
  if (!candidate?.placeId || !candidate?.businessName) {
    return { ok: false, error: "Selecciona un negocio.", errorCode: "INVALID_INPUT" };
  }

  try {
    const { output, sources, raw, model } = await runCompetitorRadar({
      placeId: candidate.placeId,
      businessName: candidate.businessName,
      primaryType: candidate.primaryType,
      formattedAddress: candidate.formattedAddress,
      summary: candidate.summary,
    });
    const saved = await upsertCompetitorRadarReport(
      { placeId: candidate.placeId, businessName: candidate.businessName },
      output,
      sources,
      model,
      raw
    );
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof CompetitorRadarParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Competitor Radar", "Error inesperado al analizar la competencia.");
  }
}
