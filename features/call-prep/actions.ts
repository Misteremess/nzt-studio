"use server";
// features/call-prep/actions.ts
// Server Actions for the Call Prep Agent.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { CallPrepParseError, generateCallScript } from "@/features/call-prep/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  archiveCallScript,
  deleteCallScript,
  listCallPrepCandidates,
  listCallScripts,
  restoreCallScript,
  upsertCallScript,
} from "@/features/call-prep/lib/store";
import type { CallPrepCandidate, CallScriptData, MeetingType } from "@/features/call-prep/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

const VALID_MEETING_TYPES: MeetingType[] = ["NONE", "CALL", "VIDEO_CALL", "IN_PERSON"];

function refresh() {
  revalidatePath("/call-prep");
}

/** Lists generated proposals eligible for a call script. */
export async function listCallPrepCandidatesAction(): Promise<ActionResult<CallPrepCandidate[]>> {
  try {
    const candidates = await listCallPrepCandidates();
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Error al cargar las propuestas disponibles.", errorCode: "DB_ERROR" };
  }
}

/** Lists generated call scripts. */
export async function listCallScriptsAction(includeArchived = false): Promise<ActionResult<CallScriptData[]>> {
  try {
    const scripts = await listCallScripts(includeArchived);
    return { ok: true, data: scripts };
  } catch {
    return { ok: false, error: "Error al cargar los guiones.", errorCode: "DB_ERROR" };
  }
}

/** Generates (or regenerates) the call script for the given proposal. */
export async function generateCallScriptAction(
  candidate: CallPrepCandidate,
  meetingType: unknown
): Promise<ActionResult<CallScriptData>> {
  if (!candidate?.proposalId || !candidate?.businessName) {
    return { ok: false, error: "Selecciona una propuesta.", errorCode: "INVALID_INPUT" };
  }
  const validMeeting: MeetingType = VALID_MEETING_TYPES.includes(meetingType as MeetingType)
    ? (meetingType as MeetingType)
    : "CALL";

  const context = [
    `Título: ${candidate.proposalTitle}`,
    `Resumen ejecutivo: ${candidate.executiveSummary}`,
    `Problema: ${candidate.problemStatement}`,
    `Solución propuesta: ${candidate.proposedSolution}`,
    `Pitch del MVP: ${candidate.opportunityPitch}`,
    `Inversión: ${candidate.investment}`,
  ].join("\n");

  try {
    const { output, raw, model } = await generateCallScript({
      proposalId: candidate.proposalId,
      businessName: candidate.businessName,
      meetingType: validMeeting,
      context,
    });
    const saved = await upsertCallScript({ proposalId: candidate.proposalId, meetingType: validMeeting }, output, model, raw);
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof CallPrepParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Call Prep Agent", "Error inesperado al generar el guión.");
  }
}

/** Archives a call script. */
export async function archiveCallScriptAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Guión no válido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveCallScript(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el guión.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived call script. */
export async function restoreCallScriptAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Guión no válido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreCallScript(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el guión.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a call script. */
export async function deleteCallScriptAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Guión no válido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteCallScript(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el guión.", errorCode: "DB_ERROR" };
  }
}
