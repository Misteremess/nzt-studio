// features/analyzer/lib/claude.ts
// Server-only AI integration for the AI Business Analyzer.
//
// Uses live web search (Anthropic web_search / Gemini Google Search grounding)
// so the model researches the business on the internet before answering. Routes
// to whichever provider is configured for this module; the API key never leaves
// the server.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { AiAnalysisOutput, BusinessContext, WebSource } from "@/features/analyzer/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class AnalysisParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

// Stable system prompt — cached across requests (prefix match) to cut cost.
const SYSTEM_PROMPT = `Eres un consultor de negocio digital de NZT Studio, un estudio que construye MVPs a medida para pequeños y medianos negocios locales.

Tu tarea: analizar un negocio concreto y detectar oportunidades de mejora digital accionables.

Proceso obligatorio:
1. Usa la herramienta de búsqueda web para investigar el negocio en internet: su web (si tiene), redes sociales, reseñas, presencia online, competidores cercanos y prácticas habituales de su sector.
2. Identifica qué tiene ya el negocio (activos: web, reservas online, redes, reputación, etc.).
3. Propón oportunidades de negocio concretas que NZT Studio podría desarrollar como MVP. Cada oportunidad debe incluir un desarrollo realista de "qué podríamos hacer".

Reglas:
- No inventes datos. Si no encuentras algo en internet, dilo o márcalo como desconocido.
- Sé concreto y orientado a software/MVP (no consejos genéricos de marketing).
- Escribe en español.
- Tu respuesta FINAL debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "summary": "string — resumen ejecutivo del negocio y su situación digital (2-4 frases)",
  "assets": ["string — cada activo digital que el negocio YA tiene"],
  "webFindings": {
    "text": "string — resumen de lo encontrado investigando en internet",
    "sources": [{ "title": "string", "url": "string" }]
  },
  "opportunities": [
    {
      "title": "string — título corto de la oportunidad",
      "description": "string — qué es la oportunidad y por qué importa para este negocio",
      "development": "string — qué podríamos hacer concretamente (el MVP/solución propuesta)",
      "impact": "low | medium | high",
      "effort": "low | medium | high"
    }
  ]
}`;

function buildUserPrompt(ctx: BusinessContext): string {
  const lines: string[] = [
    `Analiza este negocio:`,
    `- Nombre: ${ctx.name}`,
  ];
  if (ctx.primaryType) lines.push(`- Tipo: ${ctx.primaryType}`);
  if (ctx.types.length) lines.push(`- Categorías: ${ctx.types.join(", ")}`);
  if (ctx.formattedAddress) lines.push(`- Dirección: ${ctx.formattedAddress}`);
  if (ctx.businessStatus) lines.push(`- Estado: ${ctx.businessStatus}`);
  if (ctx.rating !== null)
    lines.push(`- Valoración: ${ctx.rating} (${ctx.userRatingCount ?? 0} reseñas)`);
  lines.push(`- Web: ${ctx.websiteUri ?? "NO TIENE web registrada en Google"}`);
  if (ctx.nationalPhone) lines.push(`- Teléfono: ${ctx.nationalPhone}`);
  if (ctx.googleMapsUri) lines.push(`- Google Maps: ${ctx.googleMapsUri}`);
  lines.push(
    `- Horario publicado: ${ctx.hasOpeningHours ? "sí" : "no"}`,
    ``,
    `Investiga este negocio en internet y devuelve el análisis en el formato JSON indicado.`
  );
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  output: AiAnalysisOutput;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Runs the full AI analysis for a business: live web research, then a
 * structured JSON verdict, using the configured provider.
 * Throws MissingApiKeyError / AiApiError / AnalysisParseError on failure.
 */
export async function analyzeBusiness(ctx: BusinessContext): Promise<AnalyzeResult> {
  const provider = await getModuleProvider("analyzer");
  const { text, raw, model, sources } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(ctx),
    maxTokens: 16000,
    webSearch: true,
  });

  const output = parseAnalysis(text);

  // Backfill sources from the model's actual web search results if it omitted them.
  if (output.webFindings.sources.length === 0) {
    output.webFindings.sources = sources;
  }

  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/** Pulls the first/last balanced JSON object out of the model text and parses it. */
function parseAnalysis(text: string): AiAnalysisOutput {
  let candidate = text.trim();
  // Strip markdown fences if present.
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AnalysisParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AnalysisParseError("No se pudo interpretar la respuesta de la IA.");
  }

  return normalizeOutput(parsed);
}

function normalizeOutput(value: unknown): AiAnalysisOutput {
  if (typeof value !== "object" || value === null) {
    throw new AnalysisParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = value as Record<string, unknown>;

  const summary = typeof o.summary === "string" ? o.summary : "";
  const assets = Array.isArray(o.assets)
    ? o.assets.filter((a): a is string => typeof a === "string")
    : [];

  const wf = (o.webFindings ?? {}) as Record<string, unknown>;
  const webFindings = {
    text: typeof wf.text === "string" ? wf.text : "",
    sources: normalizeSources(wf.sources),
  };

  const opportunities = Array.isArray(o.opportunities)
    ? o.opportunities.map(normalizeOpportunity).filter((x) => x.title.length > 0)
    : [];

  if (!summary && opportunities.length === 0) {
    throw new AnalysisParseError("La IA no produjo un análisis utilizable.");
  }

  return { summary, assets, webFindings, opportunities };
}

function normalizeSources(value: unknown): WebSource[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => {
      if (typeof s !== "object" || s === null) return null;
      const r = s as Record<string, unknown>;
      const url = typeof r.url === "string" ? r.url : "";
      if (!url) return null;
      return { title: typeof r.title === "string" && r.title ? r.title : url, url };
    })
    .filter((s): s is WebSource => s !== null);
}

function normalizeLevel(value: unknown): "low" | "medium" | "high" | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}

function normalizeOpportunity(value: unknown): AiAnalysisOutput["opportunities"][number] {
  const o = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    title: typeof o.title === "string" ? o.title : "",
    description: typeof o.description === "string" ? o.description : "",
    development: typeof o.development === "string" ? o.development : "",
    impact: normalizeLevel(o.impact),
    effort: normalizeLevel(o.effort),
  };
}
