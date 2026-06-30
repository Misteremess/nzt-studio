// features/email-generator/lib/claude.ts
// Server-only AI integration for the Email Generator.
//
// Drafts a personalized commercial email in Spanish from a free-text
// "objective" plus optional context: a recipient, a target business, one or
// several opportunities/MVPs to present (without attaching them), and an
// optional meeting proposal (call / Teams / in person). Routes to whichever
// provider (Anthropic / Gemini) is configured for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import {
  MEETING_TYPE_META,
  type EmailDraftInput,
  type EmailOutput,
} from "@/features/email-generator/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class EmailParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el responsable comercial de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: redactar un CORREO comercial o de seguimiento, personalizado, listo para enviar.

Reglas:
- Escribe en español, con un tono profesional pero cercano, breve y directo. Nada de relleno ni frases genéricas de spam.
- El correo debe centrarse en el OBJETIVO indicado por el usuario. Ese objetivo manda sobre cualquier otra cosa.
- Si se indican oportunidades/MVPs a presentar, descríbelos en términos de VALOR para el negocio (qué gana, qué problema resuelve), sin tecnicismos y SIN mencionar que se adjunta ningún documento o archivo — el correo no lleva adjuntos.
- Si no se indican oportunidades/MVPs, NO inventes ninguno: el correo puede ser totalmente independiente (p.ej. presentar los servicios de NZT Studio o sus agentes de IA).
- Si se pide proponer una reunión, incluye una llamada a la acción concreta para agendarla (llamada, videollamada por Teams o reunión presencial, según se indique), proponiendo flexibilidad de horario salvo que se den preferencias concretas.
- Usa el nombre del destinatario y de la empresa si se proporcionan, para personalizar. Si no se proporcionan, escribe el correo de forma que sea fácil rellenarlos a mano (p.ej. "Hola [nombre]").
- Firma con el nombre del remitente si se proporciona.
- El cuerpo del correo debe estar en texto plano, con saltos de línea entre párrafos (usa \\n\\n), sin HTML ni markdown.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "subject": "string",  // asunto del correo, conciso y específico
  "body": "string"      // cuerpo del correo en texto plano
}`;

function buildUserPrompt(input: EmailDraftInput): string {
  const lines: string[] = [`OBJETIVO DEL CORREO: ${input.objective}`, ``];

  if (input.recipientName || input.recipientRole || input.businessName) {
    lines.push(`DESTINATARIO:`);
    if (input.recipientName) lines.push(`- Nombre: ${input.recipientName}`);
    if (input.recipientRole) lines.push(`- Cargo: ${input.recipientRole}`);
    if (input.businessName) lines.push(`- Empresa/negocio: ${input.businessName}`);
    lines.push(``);
  }

  if (input.references.length > 0) {
    lines.push(`OPORTUNIDADES/MVPS A PRESENTAR (sin adjuntar nada):`);
    for (const ref of input.references) {
      lines.push(`- ${ref.title}${ref.pitch ? `: ${ref.pitch}` : ""}`);
    }
    lines.push(``);
  } else {
    lines.push(`OPORTUNIDADES/MVPS A PRESENTAR: ninguna. No inventes ninguna.`, ``);
  }

  if (input.meetingType !== "NONE") {
    lines.push(`PROPONER REUNIÓN: ${MEETING_TYPE_META[input.meetingType]}`);
    if (input.meetingNotes) lines.push(`- Preferencias de horario/lugar: ${input.meetingNotes}`);
    lines.push(``);
  }

  if (input.senderName) lines.push(`FIRMA: ${input.senderName}`, ``);

  lines.push(`Devuelve el correo en el formato JSON indicado.`);
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateEmailResult {
  output: EmailOutput;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Generates a subject + body for a personalized email using the configured
 * provider. Throws MissingApiKeyError / AiApiError / EmailParseError on failure.
 */
export async function generateEmail(input: EmailDraftInput): Promise<GenerateEmailResult> {
  const provider = await getModuleProvider("email-generator");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 3000,
  });

  const output = parseEmail(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseEmail(text: string): EmailOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new EmailParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new EmailParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new EmailParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;
  const subject = typeof o.subject === "string" ? o.subject : "";
  const body = typeof o.body === "string" ? o.body : "";
  if (!subject && !body) {
    throw new EmailParseError("La IA no produjo un correo utilizable.");
  }
  return { subject, body };
}
