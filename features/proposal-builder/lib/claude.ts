// features/proposal-builder/lib/claude.ts
// Server-only AI integration for the Proposal Builder.
//
// Turns an MVP spec (and its pricing, if available) into a complete, client-
// ready commercial proposal in Spanish: executive summary, scope, deliverables,
// phases, terms, investment and a call to action. Routes to whichever provider
// (Anthropic / Gemini) is configured for this module; the API key never leaves
// the server.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type {
  ProposalInput,
  ProposalOutput,
  ProposalPhase,
} from "@/features/proposal-builder/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class ProposalParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el responsable comercial de NZT Studio, un estudio que construye y vende MVPs a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: a partir de la especificación de un MVP (y su pricing, si lo hay), redactar una PROPUESTA COMERCIAL completa, profesional y persuasiva, lista para enviar al cliente.

Reglas:
- Escribe en español, con un tono profesional pero cercano y claro. Nada de jerga técnica innecesaria; el cliente es el dueño de un negocio local, no un ingeniero.
- La propuesta debe estar centrada en el VALOR para el negocio: cómo le ayuda, qué problema resuelve, qué gana.
- Sé concreto y honesto. Define claramente el alcance y lo que queda fuera para evitar malentendidos.
- Si recibes pricing, intégralo de forma natural en el apartado de inversión (precios en euros, distinguiendo construcción única y mantenimiento mensual). Si NO hay pricing, redacta el apartado de inversión de forma cualitativa sin inventar cifras concretas.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "title": "string",                 // título de la propuesta
  "executiveSummary": "string",      // resumen ejecutivo (2-4 frases)
  "problemStatement": "string",      // el problema/oportunidad del negocio
  "proposedSolution": "string",      // la solución propuesta, en términos de negocio
  "scope": ["string"],               // qué incluye el proyecto (entregable a entregable)
  "outOfScope": ["string"],          // qué NO incluye (límites claros)
  "deliverables": ["string"],        // entregables concretos
  "phases": [                        // plan de trabajo por fases
    { "title": "string", "description": "string" }
  ],
  "terms": ["string"],               // condiciones (plazos, pagos, garantías, propiedad)
  "investment": "string",            // apartado de inversión, integrando el pricing si existe
  "nextSteps": ["string"],           // próximos pasos para arrancar
  "callToAction": "string"           // llamada a la acción final
}`;

function buildUserPrompt(input: ProposalInput): string {
  const lines: string[] = [
    `Redacta la propuesta comercial para este MVP.`,
    ``,
    `NEGOCIO:`,
    `- Nombre: ${input.businessName}`,
  ];
  if (input.businessSummary) lines.push(`- Contexto: ${input.businessSummary}`);
  lines.push(
    ``,
    `MVP:`,
    `- Oportunidad: ${input.opportunityTitle}`,
    `- Pitch: ${input.pitch}`,
    `- Problema: ${input.problem}`,
    `- Solución: ${input.solution}`,
    `- Usuario objetivo: ${input.targetUser}`
  );
  if (input.coreFeatures.length > 0) {
    lines.push(`- Features del MVP:`, ...input.coreFeatures.map((f) => `  · ${f}`));
  }
  if (input.futureFeatures.length > 0) {
    lines.push(`- Mejoras posteriores (fuera del MVP):`, ...input.futureFeatures.map((f) => `  · ${f}`));
  }
  if (input.techStack.length > 0) {
    lines.push(`- Stack: ${input.techStack.join(", ")}`);
  }
  if (input.timeline) lines.push(`- Tiempo estimado: ${input.timeline}`);
  if (input.complexity) lines.push(`- Complejidad: ${input.complexity}`);

  if (input.pricing) {
    const p = input.pricing;
    lines.push(
      ``,
      `PRICING (intégralo en el apartado de inversión):`,
      `- Construcción (pago único): ${p.setupPrice} ${p.currency}`,
      p.monthlyPrice != null
        ? `- Mantenimiento mensual: ${p.monthlyPrice} ${p.currency}/mes`
        : `- Sin cuota mensual de mantenimiento.`,
    );
    if (p.paymentTerms) lines.push(`- Condiciones de pago: ${p.paymentTerms}`);
    if (p.tiers.length > 0) {
      lines.push(`- Planes:`);
      for (const t of p.tiers) {
        const rec = p.recommendedTier === t.name ? " (recomendado)" : "";
        lines.push(`  · ${t.name}${rec}: ${t.price} ${p.currency} ${t.billing}. ${t.description}`);
      }
    }
  } else {
    lines.push(
      ``,
      `PRICING: no disponible. Redacta el apartado de inversión de forma cualitativa, sin inventar cifras.`
    );
  }

  lines.push(``, `Devuelve la propuesta en el formato JSON indicado.`);
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateProposalResult {
  output: ProposalOutput;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Generates a structured commercial proposal for an MVP spec using the
 * configured provider.
 * Throws MissingApiKeyError / AiApiError / ProposalParseError on failure.
 */
export async function generateProposal(input: ProposalInput): Promise<GenerateProposalResult> {
  const provider = await getModuleProvider("proposal-builder");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 8000,
  });

  const output = parseProposal(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseProposal(text: string): ProposalOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ProposalParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ProposalParseError("No se pudo interpretar la respuesta de la IA.");
  }

  return normalizeOutput(parsed);
}

function normalizeOutput(value: unknown): ProposalOutput {
  if (typeof value !== "object" || value === null) {
    throw new ProposalParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = value as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const output: ProposalOutput = {
    title: str(o.title),
    executiveSummary: str(o.executiveSummary),
    problemStatement: str(o.problemStatement),
    proposedSolution: str(o.proposedSolution),
    scope: toStringArray(o.scope),
    outOfScope: toStringArray(o.outOfScope),
    deliverables: toStringArray(o.deliverables),
    phases: toPhases(o.phases),
    terms: toStringArray(o.terms),
    nextSteps: toStringArray(o.nextSteps),
    investment: str(o.investment),
    callToAction: str(o.callToAction),
  };

  if (!output.title && !output.executiveSummary && output.scope.length === 0) {
    throw new ProposalParseError("La IA no produjo una propuesta utilizable.");
  }
  return output;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toPhases(value: unknown): ProposalPhase[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p) => {
      if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
      const r = p as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const description = typeof r.description === "string" ? r.description : "";
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((p): p is ProposalPhase => p !== null);
}
