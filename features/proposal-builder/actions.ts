"use server";
// features/proposal-builder/actions.ts
// Server Actions for the Proposal Builder.
// All Claude API access and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { generateProposal, ProposalParseError } from "@/features/proposal-builder/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  getProposalInput,
  listProposalBusinesses,
  saveProposal,
  archiveProposal,
  restoreProposal,
  deleteProposal,
} from "@/features/proposal-builder/lib/store";
import type { ProposalBusiness, ProposalData } from "@/features/proposal-builder/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Returns the proposal inbox: businesses with their MVP specs + proposals. */
export async function listProposalsAction(includeArchived = false): Promise<ActionResult<ProposalBusiness[]>> {
  try {
    const businesses = await listProposalBusinesses(includeArchived);
    return { ok: true, data: businesses };
  } catch {
    return { ok: false, error: "Error al cargar el Proposal Builder.", errorCode: "DB_ERROR" };
  }
}

/** Archives the proposal for an MVP spec. */
export async function archiveProposalAction(proposalId: string): Promise<ActionResult<void>> {
  if (!proposalId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveProposal(proposalId);
    revalidatePath("/proposal-builder");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar la propuesta.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived proposal. */
export async function restoreProposalAction(proposalId: string): Promise<ActionResult<void>> {
  if (!proposalId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreProposal(proposalId);
    revalidatePath("/proposal-builder");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar la propuesta.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a proposal record. */
export async function deleteProposalAction(proposalId: string): Promise<ActionResult<void>> {
  if (!proposalId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteProposal(proposalId);
    revalidatePath("/proposal-builder");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar la propuesta.", errorCode: "DB_ERROR" };
  }
}

/** Generates (or re-generates) the commercial proposal for an MVP spec. */
export async function generateProposalAction(
  mvpSpecId: string
): Promise<ActionResult<ProposalData>> {
  if (!mvpSpecId || typeof mvpSpecId !== "string") {
    return { ok: false, error: "MVP no válido.", errorCode: "INVALID_INPUT" };
  }

  let input;
  try {
    input = await getProposalInput(mvpSpecId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!input) {
    return { ok: false, error: "MVP no encontrado.", errorCode: "NOT_FOUND" };
  }

  try {
    const { output, raw, model } = await generateProposal(input);
    const saved = await saveProposal(mvpSpecId, output, model, raw);
    revalidatePath("/proposal-builder");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof ProposalParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Proposal Builder", "Error inesperado al generar la propuesta.");
  }
}
