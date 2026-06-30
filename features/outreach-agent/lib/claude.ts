// features/outreach-agent/lib/claude.ts
// Server-only AI integration for the Outreach Agent.
//
// Generates a 3-step follow-up sequence (different angle per email) for a
// business that already has an AI-detected opportunity and a generated
// proposal. Routes to whichever provider (Anthropic / Gemini) is configured
// for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { OutreachInput, OutreachOutput, OutreachStep } from "@/features/outreach-agent/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class OutreachParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutreachParseError";
  }
}

const SYSTEM_PROMPT = `Eres el responsable comercial de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: a partir del contexto de un negocio (resumen, oportunidad detectada y propuesta ya enviada), genera una SECUENCIA de 3 correos de seguimiento, cada uno con un ángulo distinto:
1. Directo: recordatorio breve de la propuesta enviada, recapitulando el valor en una frase.
2. Valor añadido: aporta un dato, idea o ejemplo nuevo relacionado con la oportunidad (sin inventar datos falsos del negocio del destinatario; puedes hablar de tendencias generales del sector o casos de uso típicos).
3. Última oportunidad: cierre con tono cordial pero con sensación de urgencia/cierre del ciclo, dejando la puerta abierta a retomar el contacto en el futuro.

Reglas:
- Escribe en español, tono profesional pero cercano, breve (máximo 120 palabras por correo).
- No repitas literalmente el mismo texto entre correos.
- El cuerpo debe estar en texto plano, con saltos de línea entre párrafos (usa \\n\\n), sin HTML ni markdown.
- Asume que el destinatario ya recibió una propuesta — no la repitas entera, solo refiérete a ella.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "steps": [
    { "stepNumber": 1, "delayDays": 0, "angle": "string (nombre corto del ángulo)", "subject": "string", "body": "string" },
    { "stepNumber": 2, "delayDays": 3, "angle": "string", "subject": "string", "body": "string" },
    { "stepNumber": 3, "delayDays": 7, "angle": "string", "subject": "string", "body": "string" }
  ]
}`;

function buildUserPrompt(input: OutreachInput): string {
  return [
    `NEGOCIO: ${input.businessName}`,
    ``,
    `CONTEXTO:`,
    input.context,
    ``,
    `Genera la secuencia de 3 correos de seguimiento en el formato JSON indicado.`,
  ].join("\n");
}

export interface GenerateOutreachResult {
  output: OutreachOutput;
  raw: unknown;
  model: string;
}

export async function generateOutreachSequence(input: OutreachInput): Promise<GenerateOutreachResult> {
  const provider = await getModuleProvider("outreach-agent");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 3500,
  });

  const output = parseOutreach(text);
  return { output, raw, model };
}

const REGENERATE_SYSTEM_PROMPT = `Eres el responsable comercial de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: reescribir UN ÚNICO correo de seguimiento dentro de una secuencia comercial ya existente, teniendo en cuenta el contexto del negocio, el resto de correos de la secuencia (para no repetirte) y, si se proporciona, una instrucción del usuario sobre cómo cambiar este correo en concreto.

Reglas:
- Escribe en español, tono profesional pero cercano, breve (máximo 120 palabras).
- El cuerpo debe estar en texto plano, con saltos de línea entre párrafos (usa \\n\\n), sin HTML ni markdown.
- No repitas literalmente el contenido de los otros correos de la secuencia.
- Asume que el destinatario ya recibió una propuesta — no la repitas entera, solo refiérete a ella.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{ "angle": "string (nombre corto del ángulo)", "subject": "string", "body": "string" }`;

export interface RegenerateStepInput {
  context: string;
  businessName: string;
  otherSteps: OutreachStep[];
  step: OutreachStep;
  instruction?: string;
}

export interface RegeneratedStep {
  angle: string;
  subject: string;
  body: string;
}

export async function regenerateOutreachStep(
  input: RegenerateStepInput
): Promise<{ output: RegeneratedStep; raw: unknown; model: string }> {
  const provider = await getModuleProvider("outreach-agent");

  const otherStepsText = input.otherSteps.length
    ? input.otherSteps
        .map((s) => `Paso ${s.stepNumber} (${s.angle || "sin ángulo"}): ${s.subject}\n${s.body}`)
        .join("\n\n")
    : "(no hay otros correos en la secuencia)";

  const user = [
    `NEGOCIO: ${input.businessName}`,
    ``,
    `CONTEXTO:`,
    input.context,
    ``,
    `OTROS CORREOS DE LA SECUENCIA (no los repitas):`,
    otherStepsText,
    ``,
    `CORREO ACTUAL A REESCRIBIR (Paso ${input.step.stepNumber}, ángulo "${input.step.angle}"):`,
    `Asunto: ${input.step.subject}`,
    input.step.body,
    ``,
    input.instruction
      ? `INSTRUCCIÓN DEL USUARIO PARA ESTA REESCRITURA: ${input.instruction}`
      : `Mejora este correo manteniendo su ángulo y propósito dentro de la secuencia.`,
    ``,
    `Devuelve el correo reescrito en el formato JSON indicado.`,
  ].join("\n");

  const { text, raw, model } = await generateText(provider, {
    system: REGENERATE_SYSTEM_PROMPT,
    user,
    maxTokens: 1500,
  });

  const output = parseRegeneratedStep(text);
  return { output, raw, model };
}

function parseRegeneratedStep(text: string): RegeneratedStep {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new OutreachParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new OutreachParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new OutreachParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;
  const subject = typeof o.subject === "string" ? o.subject : "";
  const body = typeof o.body === "string" ? o.body : "";
  if (!subject || !body) {
    throw new OutreachParseError("La IA no produjo un correo utilizable.");
  }

  return {
    angle: typeof o.angle === "string" ? o.angle : "",
    subject,
    body,
  };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseOutreach(text: string): OutreachOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new OutreachParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new OutreachParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new OutreachParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;
  if (!Array.isArray(o.steps) || o.steps.length === 0) {
    throw new OutreachParseError("La IA no generó ningún paso de la secuencia.");
  }

  const steps: OutreachStep[] = o.steps
    .map((s, i): OutreachStep | null => {
      if (typeof s !== "object" || s === null) return null;
      const r = s as Record<string, unknown>;
      const subject = typeof r.subject === "string" ? r.subject : "";
      const body = typeof r.body === "string" ? r.body : "";
      if (!subject && !body) return null;
      return {
        stepNumber: typeof r.stepNumber === "number" ? r.stepNumber : i + 1,
        delayDays: typeof r.delayDays === "number" ? r.delayDays : i * 3,
        angle: typeof r.angle === "string" ? r.angle : "",
        subject,
        body,
        status: "pending",
        sentAt: null,
      };
    })
    .filter((s): s is OutreachStep => s !== null);

  if (steps.length === 0) {
    throw new OutreachParseError("La IA no produjo ningún correo utilizable.");
  }

  return { steps };
}
