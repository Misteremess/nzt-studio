"use server";
// features/knowledge-base/actions.ts
// Server Actions for the Knowledge Base: create, update and delete items.

import { revalidatePath } from "next/cache";

import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getKnowledgeData,
  updateKnowledgeItem,
} from "@/features/knowledge-base/lib/store";
import { KB_TYPES, type KbData, type KbInput, type KbType } from "@/features/knowledge-base/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

function isType(v: string): v is KbType {
  return (KB_TYPES as string[]).includes(v);
}

function validate(input: unknown): KbInput | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Record<string, unknown>;
  if (typeof r.type !== "string" || !isType(r.type)) return null;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const content = typeof r.content === "string" ? r.content.trim() : "";
  if (!title || !content) return null;
  const tags = Array.isArray(r.tags)
    ? [...new Set(r.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean))].slice(0, 12)
    : [];
  return { type: r.type, title: title.slice(0, 200), content, tags };
}

export async function createKnowledgeItemAction(input: KbInput): Promise<ActionResult<KbData>> {
  const clean = validate(input);
  if (!clean) return { ok: false, error: "Faltan título o contenido.", errorCode: "INVALID_INPUT" };
  try {
    await createKnowledgeItem(clean);
    revalidatePath("/knowledge-base");
    return { ok: true, data: await getKnowledgeData() };
  } catch {
    return { ok: false, error: "No se pudo crear el elemento.", errorCode: "DB_ERROR" };
  }
}

export async function updateKnowledgeItemAction(
  id: string,
  input: KbInput
): Promise<ActionResult<KbData>> {
  if (!id) return { ok: false, error: "Elemento no válido.", errorCode: "INVALID_INPUT" };
  const clean = validate(input);
  if (!clean) return { ok: false, error: "Faltan título o contenido.", errorCode: "INVALID_INPUT" };
  try {
    await updateKnowledgeItem(id, clean);
    revalidatePath("/knowledge-base");
    return { ok: true, data: await getKnowledgeData() };
  } catch {
    return { ok: false, error: "No se pudo guardar el elemento.", errorCode: "DB_ERROR" };
  }
}

export async function deleteKnowledgeItemAction(id: string): Promise<ActionResult<KbData>> {
  if (!id) return { ok: false, error: "Elemento no válido.", errorCode: "INVALID_INPUT" };
  try {
    await deleteKnowledgeItem(id);
    revalidatePath("/knowledge-base");
    return { ok: true, data: await getKnowledgeData() };
  } catch {
    return { ok: false, error: "No se pudo eliminar el elemento.", errorCode: "DB_ERROR" };
  }
}
