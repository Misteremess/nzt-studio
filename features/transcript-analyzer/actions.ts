"use server";
// features/transcript-analyzer/actions.ts
// Server Actions for the Transcript Analyzer.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { TranscriptAnalyzerParseError, analyzeTranscript } from "@/features/transcript-analyzer/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  archiveTranscriptAnalysis,
  createTranscriptAnalysis,
  deleteTranscriptAnalysis,
  listTranscriptAnalyses,
  restoreTranscriptAnalysis,
} from "@/features/transcript-analyzer/lib/store";
import type { TranscriptAnalysisData } from "@/features/transcript-analyzer/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

const MIN_TRANSCRIPT_LENGTH = 50;
const MAX_TRANSCRIPT_LENGTH = 50_000;

function refresh() {
  revalidatePath("/transcript-analyzer");
}

/** Lists generated transcript analyses. */
export async function listTranscriptAnalysesAction(includeArchived = false): Promise<ActionResult<TranscriptAnalysisData[]>> {
  try {
    const analyses = await listTranscriptAnalyses(includeArchived);
    return { ok: true, data: analyses };
  } catch {
    return { ok: false, error: "Error al cargar los análisis.", errorCode: "DB_ERROR" };
  }
}

/** Analyzes a pasted call/meeting transcript. */
export async function analyzeTranscriptAction(input: {
  businessName?: string;
  transcript: string;
}): Promise<ActionResult<TranscriptAnalysisData>> {
  const transcript = input.transcript?.trim() ?? "";
  if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return {
      ok: false,
      error: `La transcripción debe tener al menos ${MIN_TRANSCRIPT_LENGTH} caracteres.`,
      errorCode: "INVALID_INPUT",
    };
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return {
      ok: false,
      error: `La transcripción es demasiado larga (máximo ${MAX_TRANSCRIPT_LENGTH} caracteres).`,
      errorCode: "INVALID_INPUT",
    };
  }

  const businessName = input.businessName?.trim() || undefined;

  try {
    const { output, raw, model } = await analyzeTranscript({ businessName, transcript });
    const saved = await createTranscriptAnalysis({ businessName, transcript }, output, model, raw);
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof TranscriptAnalyzerParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Transcript Analyzer", "Error inesperado al analizar la transcripción.");
  }
}

/** Archives a transcript analysis. */
export async function archiveTranscriptAnalysisAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Análisis no válido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveTranscriptAnalysis(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived transcript analysis. */
export async function restoreTranscriptAnalysisAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Análisis no válido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreTranscriptAnalysis(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el análisis.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a transcript analysis. */
export async function deleteTranscriptAnalysisAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Análisis no válido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteTranscriptAnalysis(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el análisis.", errorCode: "DB_ERROR" };
  }
}
