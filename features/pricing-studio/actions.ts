"use server";
// features/pricing-studio/actions.ts
// Server Actions for the Pricing Studio.
// All Claude API access and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/require-session";
import { generatePricing, PricingParseError } from "@/features/pricing-studio/lib/claude";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  getPricingInput,
  listPricingBusinesses,
  savePricing,
  archivePricing,
  restorePricing,
  deletePricing,
} from "@/features/pricing-studio/lib/store";
import type { PricingBusiness, PricingData } from "@/features/pricing-studio/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Returns the pricing inbox: businesses with their MVP specs + pricing. */
export async function listPricingAction(includeArchived = false): Promise<ActionResult<PricingBusiness[]>> {
  try {
    const businesses = await listPricingBusinesses(includeArchived);
    return { ok: true, data: businesses };
  } catch {
    return { ok: false, error: "Error al cargar el Pricing Studio.", errorCode: "DB_ERROR" };
  }
}

/** Archives the pricing for an MVP spec. */
export async function archivePricingAction(pricingId: string): Promise<ActionResult<void>> {
  if (!pricingId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await archivePricing(pricingId);
    revalidatePath("/pricing-studio");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el pricing.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived pricing. */
export async function restorePricingAction(pricingId: string): Promise<ActionResult<void>> {
  if (!pricingId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await restorePricing(pricingId);
    revalidatePath("/pricing-studio");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el pricing.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes a pricing record. */
export async function deletePricingAction(pricingId: string): Promise<ActionResult<void>> {
  if (!pricingId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await deletePricing(pricingId);
    revalidatePath("/pricing-studio");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el pricing.", errorCode: "DB_ERROR" };
  }
}

/** Generates (or re-generates) the pricing for an MVP spec. */
export async function generatePricingAction(
  mvpSpecId: string
): Promise<ActionResult<PricingData>> {
  if (!mvpSpecId || typeof mvpSpecId !== "string") {
    return { ok: false, error: "MVP no válido.", errorCode: "INVALID_INPUT" };
  }

  let input;
  try {
    input = await getPricingInput(mvpSpecId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!input) {
    return { ok: false, error: "MVP no encontrado.", errorCode: "NOT_FOUND" };
  }

  try {
    const { output, raw, model } = await generatePricing(input);
    const saved = await savePricing(mvpSpecId, output, model, raw);
    revalidatePath("/pricing-studio");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof PricingParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "Pricing Studio", "Error inesperado al generar el pricing.");
  }
}
