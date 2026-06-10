"use server";
// features/settings/actions.ts
// Server Actions for app settings (per-module AI provider).

import { revalidatePath } from "next/cache";

import { setModuleProvider } from "@/lib/ai/settings";
import { AI_MODULES, asProvider, type AiModuleId } from "@/lib/ai/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; errorCode?: string };

/** Persists the AI provider choice for a single module. */
export async function setModuleProviderAction(
  moduleId: AiModuleId,
  provider: string
): Promise<ActionResult<{ moduleId: AiModuleId; provider: "anthropic" | "gemini" }>> {
  const validModule = AI_MODULES.some((m) => m.id === moduleId);
  const validProvider = asProvider(provider);
  if (!validModule || !validProvider) {
    return { ok: false, error: "Selección no válida.", errorCode: "INVALID_INPUT" };
  }

  try {
    await setModuleProvider(moduleId, validProvider);
    revalidatePath("/settings");
    return { ok: true, data: { moduleId, provider: validProvider } };
  } catch {
    return { ok: false, error: "No se pudo guardar el ajuste.", errorCode: "DB_ERROR" };
  }
}
