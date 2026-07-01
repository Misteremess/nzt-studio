"use server";
// features/presupuestos/actions.ts
// Server Actions for the Presupuestos module.
// All AI access and Prisma writes happen here; session is enforced per action.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { mapAiError } from "@/lib/ai/action-errors";
import { generateBudgetDraft, BudgetParseError } from "@/features/presupuestos/lib/ai";
import {
  createBudget,
  updateBudget,
  updateBudgetStatus,
  deleteBudget,
} from "@/features/presupuestos/lib/store";
import { getIssuerSettings, saveIssuerSettings } from "@/features/presupuestos/lib/issuer";
import {
  generateDraftSchema,
  saveBudgetSchema,
  issuerSettingsSchema,
} from "@/features/presupuestos/schemas";
import type {
  BudgetDraft,
  BudgetRecord,
  BudgetStatus,
  IssuerSettings,
} from "@/features/presupuestos/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

const VALID_STATUSES: BudgetStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];

/** Generates a professional budget draft (title, items, terms) from a brief. */
export async function generateBudgetDraftAction(
  input: unknown
): Promise<ActionResult<BudgetDraft>> {
  await requireSession();

  const parsed = generateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos.", errorCode: "INVALID_INPUT" };
  }

  try {
    const { draft } = await generateBudgetDraft(parsed.data);
    return { ok: true, data: draft };
  } catch (err) {
    if (err instanceof BudgetParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Presupuestos", "Error inesperado al generar el presupuesto.");
  }
}

/** Creates or updates a budget and returns the persisted record. */
export async function saveBudgetAction(input: unknown): Promise<ActionResult<BudgetRecord>> {
  await requireSession();

  const parsed = saveBudgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos.", errorCode: "INVALID_INPUT" };
  }

  try {
    const record = parsed.data.id
      ? await updateBudget(parsed.data.id, parsed.data)
      : await createBudget(parsed.data);
    revalidatePath("/presupuestos");
    return { ok: true, data: record };
  } catch (err) {
    console.error("[Presupuestos] save error", err);
    return { ok: false, error: "No se pudo guardar el presupuesto.", errorCode: "DB_ERROR" };
  }
}

/** Updates the status of a budget (DRAFT / SENT / ACCEPTED / REJECTED). */
export async function updateBudgetStatusAction(
  id: string,
  status: string
): Promise<ActionResult<void>> {
  await requireSession();

  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID no válido.", errorCode: "INVALID_INPUT" };
  }
  if (!VALID_STATUSES.includes(status as BudgetStatus)) {
    return { ok: false, error: "Estado no válido.", errorCode: "INVALID_INPUT" };
  }

  try {
    await updateBudgetStatus(id, status as BudgetStatus);
    revalidatePath("/presupuestos");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo actualizar el estado.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a budget. */
export async function deleteBudgetAction(id: string): Promise<ActionResult<void>> {
  await requireSession();

  if (!id || typeof id !== "string") {
    return { ok: false, error: "ID no válido.", errorCode: "INVALID_INPUT" };
  }

  try {
    await deleteBudget(id);
    revalidatePath("/presupuestos");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el presupuesto.", errorCode: "DB_ERROR" };
  }
}

/** Persists the issuer (emisor) fiscal identity. */
export async function saveIssuerSettingsAction(
  input: unknown
): Promise<ActionResult<IssuerSettings>> {
  await requireSession();

  const parsed = issuerSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos.", errorCode: "INVALID_INPUT" };
  }

  try {
    await saveIssuerSettings(parsed.data);
    revalidatePath("/presupuestos");
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: "No se pudieron guardar los datos del emisor.", errorCode: "DB_ERROR" };
  }
}

/** Reads the issuer identity (defaults filled in). */
export async function getIssuerSettingsAction(): Promise<ActionResult<IssuerSettings>> {
  await requireSession();
  try {
    const settings = await getIssuerSettings();
    return { ok: true, data: settings };
  } catch {
    return { ok: false, error: "No se pudieron cargar los datos del emisor.", errorCode: "DB_ERROR" };
  }
}
