// lib/ai/types.ts
// Client-safe types and metadata for the multi-provider AI layer.
// No "server-only" here: the settings UI (client component) imports these.

/** AI providers NZT Studio can route a module to. */
export type AiProvider = "anthropic" | "gemini";

/** Modules whose AI provider can be configured independently. */
export type AiModuleId =
  | "analyzer"
  | "mvp-factory"
  | "pricing-studio"
  | "proposal-builder"
  | "email-generator"
  | "home"
  | "outreach-agent"
  | "competitor-radar"
  | "call-prep"
  | "content-seo"
  | "transcript-analyzer";

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
  {
    id: "email-generator",
    label: "Email Generator",
    description: "Redacta correos comerciales y de seguimiento personalizados.",
  },
  {
    id: "home",
    label: "Home",
    description: "Noticias del sector relevantes generadas con búsqueda web.",
  },
  {
    id: "outreach-agent",
    label: "Outreach Agent",
    description: "Genera secuencias de seguimiento comercial multi-paso.",
  },
  {
    id: "competitor-radar",
    label: "Competitor Radar",
    description: "Investiga competidores cercanos con búsqueda web.",
  },
  {
    id: "call-prep",
    label: "Call Prep Agent",
    description: "Prepara guiones de llamada y reunión a partir de la propuesta.",
  },
  {
    id: "content-seo",
    label: "Content/SEO Agent",
    description: "Genera planes de contenido y copy de landing.",
  },
  {
    id: "transcript-analyzer",
    label: "Transcript Analyzer",
    description: "Analiza transcripciones de llamadas y reuniones.",
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

// ─── Anthropic model selection ─────────────────────────────────────────────────

/** Anthropic models the user can pick between for every Claude-powered module. */
export type AnthropicModel = "claude-opus-4-7" | "claude-sonnet-4-6" | "claude-haiku-4-5-20251001";

export const DEFAULT_ANTHROPIC_MODEL: AnthropicModel = "claude-opus-4-7";

export interface AnthropicModelMeta {
  id: AnthropicModel;
  label: string;
  note: string;
}

export const ANTHROPIC_MODELS: AnthropicModelMeta[] = [
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    note: "Máxima calidad y razonamiento. El más caro.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    note: "Buen equilibrio entre calidad, velocidad y coste.",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    note: "El más rápido y económico.",
  },
];

/** The settings key under which the global Anthropic model is stored. */
export const ANTHROPIC_MODEL_SETTING_KEY = "model.anthropic";

/** Narrows an arbitrary string to a valid AnthropicModel, or null. */
export function asAnthropicModel(value: string | null | undefined): AnthropicModel | null {
  return ANTHROPIC_MODELS.some((m) => m.id === value) ? (value as AnthropicModel) : null;
}

/** Human-readable label for the currently configured Anthropic model. */
export function anthropicModelLabel(model: AnthropicModel): string {
  return ANTHROPIC_MODELS.find((m) => m.id === model)?.label ?? PROVIDER_META.anthropic.modelLabel;
}

/** Label to show for a provider, accounting for the configurable Anthropic model. */
export function providerModelLabel(provider: AiProvider, anthropicModel: AnthropicModel): string {
  return provider === "anthropic" ? anthropicModelLabel(anthropicModel) : PROVIDER_META[provider].modelLabel;
}
