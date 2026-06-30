// features/competitor-radar/lib/claude.ts
// Server-only AI integration for the Competitor Radar.
//
// Uses live web search to find 2-3 nearby competitors for an analyzed
// business and identify their strengths, weaknesses and market gaps.
// Routes to whichever provider (Anthropic / Gemini) is configured for this
// module.
import "server-only";

import { generateText, type AiSource } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { CompetitorRadarInput, CompetitorRadarOutput, RadarCompetitor } from "@/features/competitor-radar/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class CompetitorRadarParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompetitorRadarParseError";
  }
}

const SYSTEM_PROMPT = `Eres un analista de mercado de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: usando búsqueda web en tiempo real, investiga la competencia cercana de un negocio local y detecta huecos de mercado que NZT Studio podría ayudar a cubrir con tecnología (web, automatización, IA).

Debes:
1. Buscar 2-3 competidores reales y cercanos al negocio (mismo sector, misma zona/ciudad si es posible).
2. Para cada competidor, indicar su nombre, su web (si la tiene) y sus fortalezas y debilidades (especialmente en su presencia digital: web, redes sociales, reservas online, SEO, etc.).
3. Identificar 3-5 huecos de mercado / oportunidades que el negocio analizado podría aprovechar frente a esa competencia.
4. Escribir un resumen breve (2-4 frases) de la situación competitiva.

Reglas:
- Escribe en español, tono profesional y orientado a la acción comercial.
- Usa información real obtenida mediante búsqueda web; no inventes nombres de competidores ni webs.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "competitors": [{ "name": "string", "website": "string", "strengths": ["string", ...], "weaknesses": ["string", ...] }, ...],
  "gaps": ["string", ...],
  "summary": "string"
}
Si un competidor no tiene web conocida, omite el campo "website" o déjalo vacío.`;

function buildUserPrompt(input: CompetitorRadarInput): string {
  return [
    `NEGOCIO A ANALIZAR: ${input.businessName}`,
    input.primaryType ? `TIPO: ${input.primaryType}` : null,
    input.formattedAddress ? `UBICACIÓN: ${input.formattedAddress}` : null,
    `RESUMEN DEL ANÁLISIS:`,
    input.summary,
    ``,
    `Investiga la competencia cercana y los huecos de mercado en el formato JSON indicado.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export interface RunCompetitorRadarResult {
  output: CompetitorRadarOutput;
  sources: AiSource[];
  raw: unknown;
  model: string;
}

export async function runCompetitorRadar(input: CompetitorRadarInput): Promise<RunCompetitorRadarResult> {
  const provider = await getModuleProvider("competitor-radar");
  const { text, raw, model, sources } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 4000,
    webSearch: true,
    expectJson: false,
  });

  const output = parseCompetitorRadar(text);
  return { output, sources, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseCompetitorRadar(text: string): CompetitorRadarOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new CompetitorRadarParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new CompetitorRadarParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new CompetitorRadarParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const competitors = toCompetitors(o.competitors);
  const gaps = toStringArray(o.gaps);
  const summary = typeof o.summary === "string" ? o.summary : "";

  if (!summary) {
    throw new CompetitorRadarParseError("La IA no produjo un informe utilizable.");
  }

  return { competitors, gaps, summary };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toCompetitors(value: unknown): RadarCompetitor[] {
  if (!Array.isArray(value)) return [];
  const out: RadarCompetitor[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) continue;
    const r = v as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    if (!name) continue;
    const website = typeof r.website === "string" && r.website.trim() ? r.website.trim() : undefined;
    const strengths = toStringArray(r.strengths);
    const weaknesses = toStringArray(r.weaknesses);
    out.push(website ? { name, website, strengths, weaknesses } : { name, strengths, weaknesses });
  }
  return out;
}
