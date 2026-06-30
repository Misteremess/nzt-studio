// features/call-prep/lib/claude.ts
// Server-only AI integration for the Call Prep Agent.
//
// Generates a call/meeting script (agenda, key points, likely objections with
// suggested responses, discovery questions, next steps) from an
// already-generated commercial proposal. Routes to whichever provider
// (Anthropic / Gemini) is configured for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import { MEETING_TYPE_META, type CallPrepInput, type CallScriptOutput, type CallObjection } from "@/features/call-prep/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class CallPrepParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallPrepParseError";
  }
}

const SYSTEM_PROMPT = `Eres el responsable comercial de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: a partir de una propuesta comercial ya redactada para un negocio, prepara un GUIÓN para la próxima llamada o reunión con el cliente.

El guión debe incluir:
- Una agenda breve (3-5 puntos) con el orden de temas a tratar.
- Los puntos clave a transmitir (la propuesta de valor, en lenguaje claro y orientado a beneficios).
- Objeciones probables del cliente (precio, tiempo, confianza, "no lo necesito ahora", etc.) con una respuesta sugerida para cada una (4-6 objeciones).
- Preguntas de descubrimiento para entender mejor las necesidades del cliente y hacer la conversación bidireccional (3-5 preguntas).
- Próximos pasos concretos a proponer al cierre de la llamada/reunión.

Reglas:
- Escribe en español, tono profesional, directo y práctico — son notas para guiar una conversación, no un documento formal.
- Sé concreto: nada de frases genéricas tipo "escuchar activamente al cliente".
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "agenda": ["string", ...],
  "keyPoints": ["string", ...],
  "objections": [{ "objection": "string", "response": "string" }, ...],
  "questions": ["string", ...],
  "nextSteps": ["string", ...]
}`;

function buildUserPrompt(input: CallPrepInput): string {
  return [
    `NEGOCIO: ${input.businessName}`,
    `TIPO DE REUNIÓN: ${MEETING_TYPE_META[input.meetingType]}`,
    ``,
    `PROPUESTA YA ENVIADA:`,
    input.context,
    ``,
    `Genera el guión de preparación en el formato JSON indicado.`,
  ].join("\n");
}

export interface GenerateCallScriptResult {
  output: CallScriptOutput;
  raw: unknown;
  model: string;
}

export async function generateCallScript(input: CallPrepInput): Promise<GenerateCallScriptResult> {
  const provider = await getModuleProvider("call-prep");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 3500,
  });

  const output = parseCallScript(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseCallScript(text: string): CallScriptOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new CallPrepParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new CallPrepParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new CallPrepParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const agenda = toStringArray(o.agenda);
  const keyPoints = toStringArray(o.keyPoints);
  const questions = toStringArray(o.questions);
  const nextSteps = toStringArray(o.nextSteps);
  const objections = toObjections(o.objections);

  if (agenda.length === 0 && keyPoints.length === 0) {
    throw new CallPrepParseError("La IA no produjo un guión utilizable.");
  }

  return { agenda, keyPoints, objections, questions, nextSteps };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toObjections(value: unknown): CallObjection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const objection = typeof r.objection === "string" ? r.objection : "";
      const response = typeof r.response === "string" ? r.response : "";
      if (!objection && !response) return null;
      return { objection, response };
    })
    .filter((o): o is CallObjection => o !== null);
}
