// features/mvp-factory/lib/claude.ts
// Server-only AI integration for the MVP Factory.
//
// Turns a selected business opportunity into a concrete, buildable MVP
// specification. No web research here — the opportunity already carries the
// context from the Analyzer. Routes to whichever provider (Anthropic / Gemini)
// is configured for this module; the API key never leaves the server.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { Complexity, MvpPhase, MvpSpecInput, MvpSpecOutput } from "@/features/mvp-factory/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class SpecParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

// Stable system prompt — cached across requests (prefix match) to cut cost.
const SYSTEM_PROMPT = `Eres un product engineer senior de NZT Studio, un estudio que construye MVPs a medida para pequeños y medianos negocios locales.

Tu tarea: convertir una oportunidad de negocio detectada en una especificación de MVP concreta, realista y construible, que el estudio pueda desarrollar y vender.

Reglas:
- Piensa como quien va a CONSTRUIR esto: features acotadas, alcance de un MVP real (no un producto enorme), stack moderno y pragmático.
- Distingue lo imprescindible (coreFeatures, lo mínimo para entregar valor) de lo posterior (futureFeatures, fuera del MVP).
- Sé concreto y específico para ESTE negocio, no genérico.
- Estima un timeline realista para un equipo pequeño.
- Escribe en español.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "pitch": "string — una frase que resume el MVP y su valor",
  "problem": "string — el problema concreto que resuelve para este negocio",
  "solution": "string — la solución propuesta en 2-4 frases",
  "targetUser": "string — quién lo usa (cliente final, dueño del negocio, etc.)",
  "coreFeatures": ["string — cada feature imprescindible del MVP"],
  "futureFeatures": ["string — mejoras posteriores fuera del MVP"],
  "techStack": ["string — tecnologías concretas recomendadas"],
  "phases": [{ "title": "string — nombre de la fase", "description": "string — qué se entrega en la fase" }],
  "timeline": "string — estimación de tiempo total, e.g. '4-6 semanas'",
  "complexity": "low | medium | high"
}`;

function buildUserPrompt(input: MvpSpecInput): string {
  const lines: string[] = [
    `Genera la especificación de MVP para esta oportunidad.`,
    ``,
    `NEGOCIO:`,
    `- Nombre: ${input.businessName}`,
  ];
  if (input.businessSummary) lines.push(`- Contexto: ${input.businessSummary}`);
  lines.push(
    ``,
    `OPORTUNIDAD:`,
    `- Título: ${input.opportunityTitle}`,
    `- Qué es: ${input.opportunityDescription}`,
    `- Idea inicial de qué hacer: ${input.opportunityDevelopment}`
  );
  if (input.impact) lines.push(`- Impacto estimado: ${input.impact}`);
  if (input.effort) lines.push(`- Esfuerzo estimado: ${input.effort}`);
  lines.push(``, `Devuelve la especificación en el formato JSON indicado.`);
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateSpecResult {
  output: MvpSpecOutput;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Generates a structured MVP specification for an opportunity using the
 * configured provider.
 * Throws MissingApiKeyError / AiApiError / SpecParseError on failure.
 */
export async function generateMvpSpec(input: MvpSpecInput): Promise<GenerateSpecResult> {
  const provider = await getModuleProvider("mvp-factory");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 8000,
  });

  const output = parseSpec(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseSpec(text: string): MvpSpecOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new SpecParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new SpecParseError("No se pudo interpretar la respuesta de la IA.");
  }

  return normalizeOutput(parsed);
}

function normalizeOutput(value: unknown): MvpSpecOutput {
  if (typeof value !== "object" || value === null) {
    throw new SpecParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = value as Record<string, unknown>;

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const output: MvpSpecOutput = {
    pitch: str(o.pitch),
    problem: str(o.problem),
    solution: str(o.solution),
    targetUser: str(o.targetUser),
    coreFeatures: toStringArray(o.coreFeatures),
    futureFeatures: toStringArray(o.futureFeatures),
    techStack: toStringArray(o.techStack),
    phases: toPhases(o.phases),
    timeline: str(o.timeline),
    complexity: toComplexity(o.complexity),
  };

  if (!output.solution && output.coreFeatures.length === 0) {
    throw new SpecParseError("La IA no produjo una especificación utilizable.");
  }
  return output;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toPhases(value: unknown): MvpPhase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p) => {
      if (typeof p !== "object" || p === null) return null;
      const r = p as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const description = typeof r.description === "string" ? r.description : "";
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((p): p is MvpPhase => p !== null);
}

function toComplexity(value: unknown): Complexity | null {
  return value === "low" || value === "medium" || value === "high" ? value : null;
}
