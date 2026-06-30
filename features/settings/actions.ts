"use server";
// features/settings/actions.ts
// Server Actions for app settings (per-module AI provider).

import { revalidatePath } from "next/cache";

import { prisma } from "@/db/prisma";
import { setAnthropicModel, setModuleProvider } from "@/lib/ai/settings";
import { AI_MODULES, asAnthropicModel, asProvider, type AiModuleId, type AnthropicModel } from "@/lib/ai/types";

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

/** Persists the global Anthropic model choice. */
export async function setAnthropicModelAction(
  model: string
): Promise<ActionResult<{ model: AnthropicModel }>> {
  const validModel = asAnthropicModel(model);
  if (!validModel) {
    return { ok: false, error: "Modelo no válido.", errorCode: "INVALID_INPUT" };
  }

  try {
    await setAnthropicModel(validModel);
    revalidatePath("/settings");
    return { ok: true, data: { model: validModel } };
  } catch {
    return { ok: false, error: "No se pudo guardar el ajuste.", errorCode: "DB_ERROR" };
  }
}

/**
 * Wipes all business data created across the app (CRM, analyses,
 * opportunities, MVPs, pricing, proposals, deliveries, emails, agents,
 * rastreador cache, knowledge base, AI run logs and home news cache) so the
 * user can start analyzing from a blank slate.
 *
 * Keeps: AI provider settings (AppSetting), prompt templates and the system
 * health check log.
 *
 * Requires the literal confirmation phrase "ELIMINAR TODO" as a safeguard
 * against accidental calls.
 */
export async function resetApplicationDataAction(
  confirmation: string
): Promise<ActionResult<{ reset: true }>> {
  if (confirmation !== "ELIMINAR TODO") {
    return { ok: false, error: "Frase de confirmación incorrecta.", errorCode: "INVALID_INPUT" };
  }

  try {
    await prisma.$transaction([
      // AI Agents pipeline (children → parents)
      prisma.aiDeliveryTask.deleteMany(),
      prisma.aiDelivery.deleteMany(),
      prisma.aiProposal.deleteMany(),
      prisma.aiPricing.deleteMany(),
      prisma.aiMvpImage.deleteMany(),
      prisma.aiMvpSpec.deleteMany(),
      prisma.aiOpportunity.deleteMany(),
      prisma.brandIdentity.deleteMany(),
      prisma.businessAnalysis.deleteMany(),

      // CRM pipeline (children → parents)
      prisma.task.deleteMany(),
      prisma.project.deleteMany(),
      prisma.proposal.deleteMany(),
      prisma.mvpSpec.deleteMany(),
      prisma.opportunity.deleteMany(),
      prisma.analysis.deleteMany(),
      prisma.aiRun.deleteMany(),
      prisma.placeCache.deleteMany(),
      prisma.company.deleteMany(),

      // Standalone modules
      prisma.aiEmailDraft.deleteMany(),
      prisma.aiAgent.deleteMany(),
      prisma.marketResearch.deleteMany(),
      prisma.knowledgeItem.deleteMany(),
      prisma.homeNewsCache.deleteMany(),
    ]);

    revalidatePath("/", "layout");
    return { ok: true, data: { reset: true } };
  } catch {
    return { ok: false, error: "No se pudo restablecer la aplicación.", errorCode: "DB_ERROR" };
  }
}
