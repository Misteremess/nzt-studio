"use server";
// features/mvp-factory/actions.ts
// Server Actions for the MVP Factory.
// All Claude API access and Prisma writes happen here — keys stay server-side.

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { requireSession } from "@/lib/auth/require-session";

import { generateMvpSpec, SpecParseError } from "@/features/mvp-factory/lib/claude";
import { generateMvpHtmlMockup, HtmlParseError } from "@/features/mvp-factory/lib/html-mockup";
import {
  extractBrandIdentityFromImage,
  extractBrandIdentityFromWebsite,
  BrandIdentityParseError,
  WebsiteUnreachableError,
} from "@/features/mvp-factory/lib/brand-identity";
import { mapAiError } from "@/lib/ai/action-errors";
import {
  generateMvpDesignImages,
  ImageGenError,
  MissingOpenAIKeyError,
  type MvpDesignImage,
} from "@/features/mvp-factory/lib/images";
import {
  getBrandIdentity,
  getMvpSpec,
  getOpportunityForSpec,
  getWebsiteForPlace,
  listFactoryBusinesses,
  saveMvpImages,
  saveMvpSpec,
  saveMvpHtmlMockup,
  saveBrandIdentity,
  archiveMvpSpec,
  restoreMvpSpec,
  deleteMvpSpec,
} from "@/features/mvp-factory/lib/spec-store";
import { MVP_IMAGE_MODEL } from "@/features/mvp-factory/lib/images";
import type { BrandIdentityData, BrandIdentityInput, FactoryBusiness, MvpSpecData } from "@/features/mvp-factory/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Returns the factory inbox: businesses with their selected opportunities + specs. */
export async function listFactoryAction(includeArchived = false): Promise<ActionResult<FactoryBusiness[]>> {
  try {
    const businesses = await listFactoryBusinesses(includeArchived);
    return { ok: true, data: businesses };
  } catch {
    return { ok: false, error: "Error al cargar el MVP Factory.", errorCode: "DB_ERROR" };
  }
}

/** Archives an MVP spec (hides it and all downstream records). */
export async function archiveMvpSpecAction(specId: string): Promise<ActionResult<void>> {
  if (!specId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await archiveMvpSpec(specId);
    revalidatePath("/mvp-factory");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo archivar el spec.", errorCode: "DB_ERROR" };
  }
}

/** Restores an archived MVP spec. */
export async function restoreMvpSpecAction(specId: string): Promise<ActionResult<void>> {
  if (!specId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await restoreMvpSpec(specId);
    revalidatePath("/mvp-factory");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo restaurar el spec.", errorCode: "DB_ERROR" };
  }
}

/** Permanently deletes an MVP spec and all cascaded AI records. */
export async function deleteMvpSpecAction(specId: string): Promise<ActionResult<void>> {
  if (!specId) return { ok: false, error: "ID inválido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteMvpSpec(specId);
    revalidatePath("/mvp-factory");
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "No se pudo eliminar el spec.", errorCode: "DB_ERROR" };
  }
}

/** Generates (or re-generates) the MVP spec for a selected opportunity. */
export async function generateMvpSpecAction(
  opportunityId: string
): Promise<ActionResult<MvpSpecData>> {
  if (!opportunityId || typeof opportunityId !== "string") {
    return { ok: false, error: "Oportunidad no válida.", errorCode: "INVALID_INPUT" };
  }

  let input;
  try {
    input = await getOpportunityForSpec(opportunityId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!input) {
    return { ok: false, error: "Oportunidad no encontrada.", errorCode: "NOT_FOUND" };
  }

  try {
    const { output, raw, model } = await generateMvpSpec(input);
    const saved = await saveMvpSpec(opportunityId, output, model, raw);
    revalidatePath("/mvp-factory");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof SpecParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "MVP Factory", "Error inesperado al generar la especificación.");
  }
}

/** Generates branded website design mockups (OpenAI) for an opportunity's spec. */
export async function generateMvpImagesAction(
  opportunityId: string
): Promise<ActionResult<MvpDesignImage[]>> {
  if (!opportunityId || typeof opportunityId !== "string") {
    return { ok: false, error: "Oportunidad no válida.", errorCode: "INVALID_INPUT" };
  }

  let input;
  let spec;
  try {
    [input, spec] = await Promise.all([
      getOpportunityForSpec(opportunityId),
      getMvpSpec(opportunityId),
    ]);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!input) {
    return { ok: false, error: "Oportunidad no encontrada.", errorCode: "NOT_FOUND" };
  }
  if (!spec) {
    return {
      ok: false,
      error: "Genera primero la spec del MVP antes de los diseños.",
      errorCode: "NO_SPEC",
    };
  }

  try {
    const images = await generateMvpDesignImages(input.businessName, input.businessSummary, spec);
    // Persist so the mockups survive reloads and module switches.
    try {
      await saveMvpImages(opportunityId, images, MVP_IMAGE_MODEL);
      revalidatePath("/mvp-factory");
    } catch (persistErr) {
      // Persistence is best-effort — still return the freshly generated images.
      console.error("[MVP Factory] Failed to persist design images", persistErr);
    }
    return { ok: true, data: images };
  } catch (err) {
    return imageErrorResult(err);
  }
}

/** Generates (or re-generates) the AI HTML landing mockup for an opportunity's MVP. */
export async function generateMvpHtmlMockupAction(
  opportunityId: string
): Promise<ActionResult<MvpSpecData>> {
  if (!opportunityId || typeof opportunityId !== "string") {
    return { ok: false, error: "Oportunidad no válida.", errorCode: "INVALID_INPUT" };
  }

  let input;
  let spec;
  try {
    [input, spec] = await Promise.all([
      getOpportunityForSpec(opportunityId),
      getMvpSpec(opportunityId),
    ]);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!input) {
    return { ok: false, error: "Oportunidad no encontrada.", errorCode: "NOT_FOUND" };
  }
  if (!spec) {
    return {
      ok: false,
      error: "Genera primero la spec del MVP antes del mockup web.",
      errorCode: "NO_SPEC",
    };
  }

  try {
    const { html, model } = await generateMvpHtmlMockup(input, spec);
    const saved = await saveMvpHtmlMockup(opportunityId, html, model);
    if (!saved) {
      return { ok: false, error: "No se encontró la spec del MVP.", errorCode: "NO_SPEC" };
    }
    revalidatePath("/mvp-factory");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof HtmlParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "MVP Factory", "Error inesperado al generar el mockup web.");
  }
}

// ─── Brand identity ───────────────────────────────────────────────────────────

const MAX_IMAGE_UPLOAD_BYTES = 4_000_000; // 4MB
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Detects the brand identity from the business's own website (logo + style hints). */
export async function extractBrandIdentityFromWebsiteAction(
  placeId: string
): Promise<ActionResult<BrandIdentityData>> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Negocio no válido.", errorCode: "INVALID_INPUT" };
  }

  let websiteUri: string | null;
  try {
    websiteUri = await getWebsiteForPlace(placeId);
  } catch {
    return { ok: false, error: "Error al acceder a la base de datos.", errorCode: "DB_ERROR" };
  }
  if (!websiteUri) {
    return { ok: false, error: "Este negocio no tiene una web detectada.", errorCode: "NO_WEBSITE" };
  }

  try {
    const extracted = await extractBrandIdentityFromWebsite(websiteUri);
    const saved = await saveBrandIdentity(placeId, extracted);
    revalidatePath("/mvp-factory");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof WebsiteUnreachableError) {
      return { ok: false, error: err.message, errorCode: "WEBSITE_UNREACHABLE" };
    }
    if (err instanceof BrandIdentityParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "MVP Factory", "Error inesperado al detectar la identidad visual.");
  }
}

/** Extracts a brand identity from a user-uploaded logo or design reference image. */
export async function extractBrandIdentityFromImageAction(
  placeId: string,
  formData: FormData,
  kind: "logo" | "reference"
): Promise<ActionResult<BrandIdentityData>> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Negocio no válido.", errorCode: "INVALID_INPUT" };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No se ha recibido ninguna imagen.", errorCode: "INVALID_INPUT" };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Formato de imagen no soportado. Usa PNG, JPEG, WEBP o GIF.",
      errorCode: "INVALID_INPUT",
    };
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return { ok: false, error: "La imagen es demasiado grande (máx. 4MB).", errorCode: "INVALID_INPUT" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractBrandIdentityFromImage(buffer.toString("base64"), file.type, kind);

    // Editing/re-detecting shouldn't silently drop a previously configured logo
    // when the new upload is only a "reference" image, or vice versa.
    const existing = await getBrandIdentity(placeId).catch(() => null);
    const merged: BrandIdentityInput = {
      ...extracted,
      logoImage: extracted.logoImage ?? existing?.logoImage ?? null,
      logoImageMime: extracted.logoImageMime ?? existing?.logoImageMime ?? null,
      referenceImage: extracted.referenceImage ?? existing?.referenceImage ?? null,
      referenceImageMime: extracted.referenceImageMime ?? existing?.referenceImageMime ?? null,
    };

    const saved = await saveBrandIdentity(placeId, merged);
    revalidatePath("/mvp-factory");
    return { ok: true, data: saved };
  } catch (err) {
    if (err instanceof BrandIdentityParseError) {
      return { ok: false, error: err.message, errorCode: "PARSE_ERROR" };
    }
    return mapAiError(err, "MVP Factory", "Error inesperado al analizar la imagen.");
  }
}

/** Saves a manually edited/configured brand identity. */
export async function saveBrandIdentityAction(
  placeId: string,
  data: BrandIdentityInput
): Promise<ActionResult<BrandIdentityData>> {
  if (!placeId || typeof placeId !== "string") {
    return { ok: false, error: "Negocio no válido.", errorCode: "INVALID_INPUT" };
  }

  try {
    const saved = await saveBrandIdentity(placeId, data);
    revalidatePath("/mvp-factory");
    return { ok: true, data: saved };
  } catch {
    return { ok: false, error: "No se pudo guardar la identidad visual.", errorCode: "DB_ERROR" };
  }
}

// ─── Error mapping ──────────────────────────────────────────────────────────

function imageErrorResult(err: unknown): ActionResult<never> {
  if (err instanceof MissingOpenAIKeyError) {
    return {
      ok: false,
      error: "Falta la clave OPENAI_API_KEY en el servidor. Añádela a .env.local.",
      errorCode: "NO_OPENAI_KEY",
    };
  }
  if (err instanceof ImageGenError) {
    return { ok: false, error: err.message, errorCode: "IMAGE_ERROR" };
  }
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    if (status === 401) {
      return { ok: false, error: "Clave de API de OpenAI no válida.", errorCode: "AUTH" };
    }
    if (status === 429) {
      return {
        ok: false,
        error: "Límite de uso de OpenAI alcanzado. Inténtalo en unos minutos.",
        errorCode: "RATE_LIMIT",
      };
    }
    if (status === 400) {
      return {
        ok: false,
        error: "La organización de OpenAI no tiene acceso a generación de imágenes o el contenido fue rechazado.",
        errorCode: "IMAGE_API_ERROR",
      };
    }
    return {
      ok: false,
      error: "Error al generar las imágenes. Inténtalo de nuevo.",
      errorCode: "IMAGE_API_ERROR",
    };
  }
  console.error("[MVP Factory] Unexpected image error", err);
  return { ok: false, error: "Error inesperado al generar los diseños.", errorCode: "UNKNOWN" };
}
