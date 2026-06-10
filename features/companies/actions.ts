"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompanyFormField =
  | "name"
  | "sector"
  | "city"
  | "website"
  | "email"
  | "phone"
  | "mapsUrl"
  | "notes"
  | "status";

export type CompanyFormState = {
  success: boolean;
  message?: string;
  fieldErrors?: Partial<Record<CompanyFormField, string[]>>;
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es obligatorio")
    .min(2, "El nombre debe tener al menos 2 caracteres"),
  sector: z.string().nullish(),
  city: z.string().nullish(),
  website: z
    .string()
    .url("Introduce una URL válida (ej. https://ejemplo.com)")
    .nullish(),
  email: z.string().email("Introduce un email válido").nullish(),
  phone: z.string().nullish(),
  mapsUrl: z.string().url("Introduce una URL válida").nullish(),
  notes: z.string().nullish(),
  status: z.enum(["PROSPECT", "ACTIVE", "PROPOSAL_SENT", "CLIENT", "INACTIVE"]),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function extractFields(formData: FormData) {
  return {
    name: normalize(formData.get("name")) ?? "",
    sector: normalize(formData.get("sector")),
    city: normalize(formData.get("city")),
    website: normalize(formData.get("website")),
    email: normalize(formData.get("email")),
    phone: normalize(formData.get("phone")),
    mapsUrl: normalize(formData.get("mapsUrl")),
    notes: normalize(formData.get("notes")),
    status: normalize(formData.get("status")),
  };
}

function toFieldErrors(
  error: z.ZodError
): Partial<Record<CompanyFormField, string[]>> {
  return error.flatten().fieldErrors as Partial<Record<CompanyFormField, string[]>>;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createCompanyAction(
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const result = companySchema.safeParse(extractFields(formData));

  if (!result.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: toFieldErrors(result.error),
    };
  }

  let companyId: string;

  try {
    const company = await prisma.company.create({
      data: result.data,
      select: { id: true },
    });
    revalidatePath("/companies");
    companyId = company.id;
  } catch {
    return {
      success: false,
      message: "Error al crear la empresa. Inténtalo de nuevo.",
    };
  }

  redirect(`/companies/${companyId}`);
}

// ─── Pipeline actions ─────────────────────────────────────────────────────────
// Llamadas directamente desde el tablero kanban (no via <form>).

export type PipelineActionResult = { ok: true } | { ok: false; error: string };

const VALID_STATUSES = companySchema.shape.status.options;

function revalidatePipeline(companyId: string) {
  revalidatePath("/companies");
  revalidatePath("/companies/pipeline");
  revalidatePath(`/companies/${companyId}`);
}

/** Mueve una empresa a otra columna del pipeline (drag & drop o selector). */
export async function updateCompanyStatusAction(
  companyId: string,
  status: string
): Promise<PipelineActionResult> {
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return { ok: false, error: "Estado no válido." };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { status: status as (typeof VALID_STATUSES)[number] },
    });
  } catch {
    return { ok: false, error: "Error al mover la empresa. Inténtalo de nuevo." };
  }

  revalidatePipeline(companyId);
  return { ok: true };
}

/** Registra que hoy hubo contacto comercial con la empresa. */
export async function registerContactAction(
  companyId: string
): Promise<PipelineActionResult> {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { lastContactAt: new Date() },
    });
  } catch {
    return { ok: false, error: "Error al registrar el contacto." };
  }

  revalidatePipeline(companyId);
  return { ok: true };
}

/** Actualiza la próxima acción planificada (texto libre; vacío = borrar). */
export async function updateNextActionAction(
  companyId: string,
  nextAction: string
): Promise<PipelineActionResult> {
  const trimmed = nextAction.trim().slice(0, 200);

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { nextAction: trimmed === "" ? null : trimmed },
    });
  } catch {
    return { ok: false, error: "Error al guardar la próxima acción." };
  }

  revalidatePipeline(companyId);
  return { ok: true };
}

export async function updateCompanyAction(
  companyId: string,
  _prevState: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const existing = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, message: "Empresa no encontrada." };
  }

  const result = companySchema.safeParse(extractFields(formData));

  if (!result.success) {
    return {
      success: false,
      message: "Revisa los campos del formulario.",
      fieldErrors: toFieldErrors(result.error),
    };
  }

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: result.data,
    });
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
  } catch {
    return {
      success: false,
      message: "Error al actualizar la empresa. Inténtalo de nuevo.",
    };
  }

  redirect(`/companies/${companyId}`);
}
