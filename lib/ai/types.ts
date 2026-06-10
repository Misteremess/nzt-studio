// lib/ai/types.ts
// Client-safe types and metadata for the multi-provider AI layer.
// No "server-only" here: the settings UI (client component) imports these.

/** AI providers NZT Studio can route a module to. */
export type AiProvider = "anthropic" | "gemini";

/** Modules whose AI provider can be configured independently. */
export type AiModuleId = "analyzer" | "mvp-factory" | "pricing-studio" | "proposal-builder";

export const AI_PROVIDERS: AiProvider[] = ["anthropic", "gemini"];

/** Default provider for every module when nothing has been configured. */
export const DEFAULT_PROVIDER: AiProvider = "anthropic";

/** Presentation metadata for each provider (shown in the settings UI). */
export interface ProviderMeta {
  id: AiProvider;
  label: string;
  modelLabel: string;
  /** Env var that must be set for this provider to work. */
  envKey: "ANTHROPIC_API_KEY" | "GEMINI_API_KEY";
  free: boolean;
  note: string;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  anthropic: {
    id: "anthropic",
    label: "Claude (Anthropic)",
    modelLabel: "Opus 4.7",
    envKey: "ANTHROPIC_API_KEY",
    free: false,
    note: "Máxima calidad. De pago (consume créditos de Anthropic).",
  },
  gemini: {
    id: "gemini",
    label: "Gemini (Google)",
    modelLabel: "2.5 Flash",
    envKey: "GEMINI_API_KEY",
    free: true,
    note: "Gratuito (free tier de Google AI Studio). Calidad muy buena.",
  },
};

/** Presentation metadata for each configurable module. */
export interface AiModuleMeta {
  id: AiModuleId;
  label: string;
  description: string;
}

export const AI_MODULES: AiModuleMeta[] = [
  {
    id: "analyzer",
    label: "Analyzer",
    description: "Análisis de negocio con investigación en internet.",
  },
  {
    id: "mvp-factory",
    label: "MVP Factory",
    description: "Genera la especificación del MVP a partir de la oportunidad.",
  },
  {
    id: "pricing-studio",
    label: "Pricing Studio",
    description: "Calcula el precio vendible del MVP.",
  },
  {
    id: "proposal-builder",
    label: "Proposal Builder",
    description: "Redacta la propuesta comercial lista para el cliente.",
  },
];

/** The settings key under which a module's provider is stored. */
export function providerSettingKey(moduleId: AiModuleId): string {
  return `provider.${moduleId}`;
}

/** Narrows an arbitrary string to a valid AiProvider, or null. */
export function asProvider(value: string | null | undefined): AiProvider | null {
  return value === "anthropic" || value === "gemini" ? value : null;
}
