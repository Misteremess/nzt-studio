// lib/ai/settings.ts
// Server-only persistence for per-module AI provider settings.
// Backed by the AppSetting key-value table.
import "server-only";

import { prisma } from "@/db/prisma";
import {
  AI_MODULES,
  ANTHROPIC_MODEL_SETTING_KEY,
  asAnthropicModel,
  asProvider,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_PROVIDER,
  providerSettingKey,
  type AiModuleId,
  type AiProvider,
  type AnthropicModel,
} from "@/lib/ai/types";

/** Returns the configured provider for a module, falling back to the default. */
export async function getModuleProvider(moduleId: AiModuleId): Promise<AiProvider> {
  const row = await prisma.appSetting.findUnique({
    where: { key: providerSettingKey(moduleId) },
  });
  return asProvider(row?.value) ?? DEFAULT_PROVIDER;
}

/** Returns the provider for every module (defaults filled in). */
export async function getAllModuleProviders(): Promise<Record<AiModuleId, AiProvider>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: AI_MODULES.map((m) => providerSettingKey(m.id)) } },
  });

  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<AiModuleId, AiProvider>;
  for (const m of AI_MODULES) {
    result[m.id] = asProvider(byKey.get(providerSettingKey(m.id))) ?? DEFAULT_PROVIDER;
  }
  return result;
}

/** Persists the provider choice for a module. */
export async function setModuleProvider(
  moduleId: AiModuleId,
  provider: AiProvider
): Promise<void> {
  const key = providerSettingKey(moduleId);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: provider },
    update: { value: provider },
  });
}

/** Reports which providers have their API key configured on the server. */
export function getProviderKeyAvailability(): Record<AiProvider, boolean> {
  return {
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
  };
}

/** Returns the configured Anthropic model, falling back to the default. */
export async function getAnthropicModel(): Promise<AnthropicModel> {
  const row = await prisma.appSetting.findUnique({
    where: { key: ANTHROPIC_MODEL_SETTING_KEY },
  });
  return asAnthropicModel(row?.value) ?? DEFAULT_ANTHROPIC_MODEL;
}

/** Persists the global Anthropic model choice. */
export async function setAnthropicModel(model: AnthropicModel): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: ANTHROPIC_MODEL_SETTING_KEY },
    create: { key: ANTHROPIC_MODEL_SETTING_KEY, value: model },
    update: { value: model },
  });
}
