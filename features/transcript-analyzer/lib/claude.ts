// features/transcript-analyzer/lib/claude.ts
// Server-only AI integration for the Transcript Analyzer.
//
// Analyzes a pasted call/meeting transcript and extracts a summary,
// requirements mentioned, objections (with suggested responses), action
// items and overall sentiment. Routes to whichever provider
// (Anthropic / Gemini) is configured for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type {
  Sentiment,
  TranscriptAnalysisOutput,
  TranscriptAnalyzerInput,
  TranscriptObjection,
} from "@/features/transcript-analyzer/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class TranscriptAnalyzerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranscriptAnalyzerParseError";
  }
}

const SYSTEM_PROMPT = `Eres un analista comercial de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: analizar la transcripción de una llamada o reunión comercial con un cliente (potencial o actual) y extraer información útil para el equipo de ventas.

Debes identificar:
- Un resumen breve (2-4 frases) de lo hablado y el resultado/estado de la conversación.
- Requisitos o necesidades mencionadas por el cliente (funcionalidades, integraciones, plazos, presupuesto, etc.).
- Objeciones planteadas por el cliente, con una respuesta sugerida para cada una si es pertinente (puede dejarse vacía si no aplica).
- Próximos pasos / action items concretos que se acordaron o que deberían realizarse.
- El sentimiento general del cliente hacia la propuesta/conversación: "positive", "neutral" o "negative".

Reglas:
- Escribe en español, tono profesional y conciso.
- Si la transcripción no menciona algo (p. ej. no hay objeciones), devuelve un array vacío para ese campo.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "summary": "string",
  "requirements": ["string", ...],
  "objections": [{ "objection": "string", "response": "string" }, ...],
  "actionItems": ["string", ...],
  "sentiment": "positive" | "neutral" | "negative"
}`;

function buildUserPrompt(input: TranscriptAnalyzerInput): string {
  return [
    input.businessName ? `NEGOCIO: ${input.businessName}` : null,
    `TRANSCRIPCIÓN:`,
    input.transcript,
    ``,
    `Analiza la transcripción en el formato JSON indicado.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export interface AnalyzeTranscriptResult {
  output: TranscriptAnalysisOutput;
  raw: unknown;
  model: string;
}

export async function analyzeTranscript(input: TranscriptAnalyzerInput): Promise<AnalyzeTranscriptResult> {
  const provider = await getModuleProvider("transcript-analyzer");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 4000,
  });

  const output = parseTranscriptAnalysis(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseTranscriptAnalysis(text: string): TranscriptAnalysisOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new TranscriptAnalyzerParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new TranscriptAnalyzerParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new TranscriptAnalyzerParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const summary = typeof o.summary === "string" ? o.summary : "";
  const requirements = toStringArray(o.requirements);
  const objections = toObjections(o.objections);
  const actionItems = toStringArray(o.actionItems);
  const sentiment = toSentiment(o.sentiment);

  if (!summary) {
    throw new TranscriptAnalyzerParseError("La IA no produjo un análisis utilizable.");
  }

  return { summary, requirements, objections, actionItems, sentiment };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toObjections(value: unknown): TranscriptObjection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const objection = typeof r.objection === "string" ? r.objection : "";
      const response = typeof r.response === "string" ? r.response : "";
      if (!objection) return null;
      return { objection, response };
    })
    .filter((o): o is TranscriptObjection => o !== null);
}

function toSentiment(value: unknown): Sentiment {
  if (value === "positive" || value === "neutral" || value === "negative") return value;
  return "neutral";
}
