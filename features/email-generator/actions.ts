"use server";
// features/email-generator/actions.ts
// Server Actions for the Email Generator.
// All AI calls and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { EmailParseError, generateEmail } from "@/features/email-generator/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  archiveEmailDraft,
  createEmailDraft,
  deleteEmailDraft,
  editEmailDraft,
  getEmailDraft,
  listEmailDrafts,
  listEmailGeneratorBusinesses,
  restoreEmailDraft,
  updateEmailDraftOutput,
} from "@/features/email-generator/lib/store";
import type {
  EmailDraftData,
  EmailDraftInput,
  EmailGeneratorBusiness,
} from "@/features/email-generator/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function refresh() {
  revalidatePath("/email-generator");
}

/** Lists email drafts. */
export async function listEmailDraftsAction(includeArchived = false): Promise<ActionResult<EmailDraftData[]>> {
  try {
    const drafts = await listEmailDrafts(includeArchived);
    return { ok: true, data: drafts };
  } catch {
    return { ok: false, error: "Error al cargar los correos.", errorCode: "DB_ERROR" };
  }
}

/** Lists businesses + opportunities/MVPs available to reference in an email. */
export async function listEmailGeneratorBusinessesAction(): Promise<ActionResult<EmailGeneratorBusiness[]>> {
  try {
    const businesses = await listEmailGeneratorBusinesses();
    return { ok: true, data: businesses };
  } catch {
    return { ok: false, error: "Error al cargar las oportunidades.", errorCode: "DB_ERROR" };
  }
}

function validate(input: unknown): EmailDraftInput | null {
  if (typeof input !== "object" || input === null) return null;
  const i = input as Record<string, unknown>;
  const objective = typeof i.objective === "string" ? i.objective.trim() : "";
  if (!objective) return null;

  const meetingType = i.meetingType;
  const validMeeting = meetingType === "NONE" || meetingType === "CALL" || meetingType === "VIDEO_CALL" || meetingType === "IN_PERSON";

  const references = Array.isArray(i.references)
    ? i.references
        .map((r) => {
          if (typeof r !== "object" || r === null) return null;
          const ref = r as Record<string, unknown>;
          const opportunityId = typeof ref.opportunityId === "string" ? ref.opportunityId : "";
          if (!opportunityId) return null;
          return {
            opportunityId,
            mvpSpecId: typeof ref.mvpSpecId === "string" ? ref.mvpSpecId : null,
            title: typeof ref.title === "string" ? ref.title : "",
            pitch: typeof ref.pitch === "string" ? ref.pitch : "",
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
    : [];

  return {
    objective,
    recipientName: typeof i.recipientName === "string" ? i.recipientName.trim() : "",
    recipientRole: typeof i.recipientRole === "string" ? i.recipientRole.trim() : "",
    businessName: typeof i.businessName === "string" ? i.businessName.trim() : "",
    senderName: typeof i.senderName === "string" ? i.senderName.trim() : "",
    meetingType: validMeeting ? meetingType : "NONE",
    meetingNotes: typeof i.meetingNotes === "string" ? i.meetingNotes.trim() : "",
    references,
  };
}

/** Generates and persists a new email draft. */
export async function generateEmailDraftAction(input: unknown): Promise<ActionResult<EmailDraftData>> {
  const parsed = validate(input);
  if (!parsed) {
    return { ok: false, error: "Indica al menos el objetivo del correo.", errorCode: "INVALID_INPUT" };
  }

  try {
    const { output, raw, model } = await generateEmail(parsed);
    const saved = await createEmailDraft(parsed, output, model, raw);
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof EmailParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Email Generator", "Error inesperado al generar el correo.");
  }
}

/** Regenerates the subject/body of an existing draft, keeping its inputs. */
export async function regenerateEmailDraftAction(draftId: string): Promise<ActionResult<EmailDraftData>> {
  if (!draftId) return { ok: false, error: "Correo no válido.", errorCode: "INVALID_INPUT" };

  let existing;
  try {
    existing = await getEmailDraft(draftId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!existing) return { ok: false, error: "Correo no encontrado.", errorCode: "NOT_FOUND" };

  try {
    const { output, raw, model } = await generateEmail(existing);
    const saved = await updateEmailDraftOutput(draftId, output, model, raw);
    refresh();
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof EmailParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Email Generator", "Error inesperado al regenerar el correo.");
  }
}

/** Saves manual edits to a draft's subject/body. */
export async function editEmailDraftAction(
  draftId: string,
  edits: { subject?: string; body?: string }
): Promise<ActionResult<EmailDraftData>> {
  if (!draftId) return { ok: false, error: "Correo no válido.", errorCode: "INVALID_INPUT" };
  try {
    const saved = await editEmailDraft(draftId, edits);
    refresh();
    return { ok: true, data: saved };
  } catch {
    return { ok: false, error: "No se pudo guardar el correo.", errorCode: "DB_ERROR" };
  }
}

/** Archives an email draft. */
export async function archiveEmailDraftAction(draftId: string): Promise<ActionResult<void>> {
  if (!draftId) return { ok: false, error: "Correo no válido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveEmailDraft(draftId);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el correo.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived email draft. */
export async function restoreEmailDraftAction(draftId: string): Promise<ActionResult<void>> {
  if (!draftId) return { ok: false, error: "Correo no válido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreEmailDraft(draftId);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el correo.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes an email draft. */
export async function deleteEmailDraftAction(draftId: string): Promise<ActionResult<void>> {
  if (!draftId) return { ok: false, error: "Correo no válido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteEmailDraft(draftId);
    refresh();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el correo.", errorCode: "DB_ERROR" };
  }
}
