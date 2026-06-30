"use server";
// features/outreach-agent/actions.ts
// Server Actions for the Outreach Agent.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { generateOutreachSequence, OutreachParseError, regenerateOutreachStep } from "@/features/outreach-agent/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  archiveOutreachSequence,
  createOutreachSequence,
  deleteOutreachSequence,
  getOutreachSequence,
  listOutreachCandidates,
  listOutreachSequences,
  replaceOutreachStep,
  restoreOutreachSequence,
  updateOutreachStep,
} from "@/features/outreach-agent/lib/store";
import type { OutreachCandidate, OutreachSequenceData, OutreachStepStatus } from "@/features/outreach-agent/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function refresh() {
  revalidatePath("/outreach-agent");
}

/** Lists businesses eligible for an outreach sequence (analysis + proposal). */
export async function listOutreachCandidatesAction(): Promise<ActionResult<OutreachCandidate[]>> {
  try {
    const candidates = await listOutreachCandidates();
    return { ok: true, data: candidates };
  } catch {
    return { ok: false, error: "Error al cargar los negocios disponibles.", errorCode: "DB_ERROR" };
  }
}

/** Lists generated outreach sequences. */
export async function listOutreachSequencesAction(includeArchived = false): Promise<ActionResult<OutreachSequenceData[]>> {
  try {
    const sequences = await listOutreachSequences(includeArchived);
    return { ok: true, data: sequences };
  } catch {
    return { ok: false, error: "Error al cargar las secuencias.", errorCode: "DB_ERROR" };
  }
}

/** Generates and persists a new outreach sequence for the given candidate. */
export async function generateOutreachSequenceAction(candidate: OutreachCandidate): Promise<ActionResult<OutreachSequenceData>> {
  if (!candidate?.placeId || !candidate?.businessName) {
    return { ok: false, error: "Selecciona un negocio.", errorCode: "INVALID_INPUT" };
  }

  const context = [
    `Resumen del negocio: ${candidate.summary}`,
    `Oportunidad detectada: ${candidate.opportunityTitle} — ${candidate.pitch}`,
    `Propuesta enviada: ${candidate.proposalTitle} (inversión: ${candidate.investment})`,
  ].join("\n");

  try {
    const { output, raw, model } = await generateOutreachSequence({
      placeId: candidate.placeId,
      businessName: candidate.businessName,
      context,
    });
    const saved = await createOutreachSequence(
      { placeId: candidate.placeId, businessName: candidate.businessName, context },
      output.steps,
      model,
      raw
    );
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof OutreachParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Outreach Agent", "Error inesperado al generar la secuencia.");
  }
}

/** Archives an outreach sequence. */
export async function archiveOutreachSequenceAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Secuencia no válida.", errorCode: "INVALID_INPUT" };
  try {
    await archiveOutreachSequence(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar la secuencia.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived outreach sequence. */
export async function restoreOutreachSequenceAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Secuencia no válida.", errorCode: "INVALID_INPUT" };
  try {
    await restoreOutreachSequence(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar la secuencia.", errorCode: "DB_ERROR" };
  }
}

/** Updates a step's status (sent/replied/no_response) and/or its edited subject/body. */
export async function updateOutreachStepAction(
  sequenceId: string,
  stepNumber: number,
  updates: { subject?: string; body?: string; status?: OutreachStepStatus; sentAt?: string | null }
): Promise<ActionResult<OutreachSequenceData>> {
  if (!sequenceId) return { ok: false, error: "Secuencia no válida.", errorCode: "INVALID_INPUT" };
  try {
    const updated = await updateOutreachStep(sequenceId, stepNumber, updates);
    if (!updated) return { ok: false, error: "Secuencia no encontrada.", errorCode: "NOT_FOUND" };
    refresh();
    return { ok: true, data: updated };
  } catch {
    return { ok: false, error: "No se pudo actualizar el correo.", errorCode: "DB_ERROR" };
  }
}

/** Regenerates a single step's content with AI, optionally guided by a custom instruction. */
export async function regenerateOutreachStepAction(
  sequenceId: string,
  stepNumber: number,
  instruction?: string
): Promise<ActionResult<OutreachSequenceData>> {
  if (!sequenceId) return { ok: false, error: "Secuencia no válida.", errorCode: "INVALID_INPUT" };

  try {
    const sequence = await getOutreachSequence(sequenceId);
    if (!sequence) return { ok: false, error: "Secuencia no encontrada.", errorCode: "NOT_FOUND" };

    const step = sequence.steps.find((s) => s.stepNumber === stepNumber);
    if (!step) return { ok: false, error: "Correo no encontrado.", errorCode: "NOT_FOUND" };

    const otherSteps = sequence.steps.filter((s) => s.stepNumber !== stepNumber);

    const { output } = await regenerateOutreachStep({
      context: sequence.context,
      businessName: sequence.businessName,
      otherSteps,
      step,
      instruction,
    });

    const updated = await replaceOutreachStep(sequenceId, stepNumber, output);
    if (!updated) return { ok: false, error: "Secuencia no encontrada.", errorCode: "NOT_FOUND" };
    refresh();
    return { ok: true, data: updated };
  } catch (err) {
    if (err instanceof OutreachParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Outreach Agent", "Error inesperado al regenerar el correo.");
  }
}

/** Permanently deletes an outreach sequence. */
export async function deleteOutreachSequenceAction(id: string): Promise<ActionResult<void>> {
  if (!id) return { ok: false, error: "Secuencia no válida.", errorCode: "INVALID_INPUT" };
  try {
    await deleteOutreachSequence(id);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar la secuencia.", errorCode: "DB_ERROR" };
  }
}
