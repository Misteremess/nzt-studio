// features/pricing-studio/lib/claude.ts
// Server-only AI integration for the Pricing Studio.
//
// Turns an MVP spec into a concrete, sellable price for a local SMB client:
// one-time build cost, optional monthly maintenance, and a set of plans. Routes
// to whichever provider (Anthropic / Gemini) is configured for this module; the
// API key never leaves the server.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { PricingInput, PricingOutput, PricingTier, SaasModel } from "@/features/pricing-studio/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class PricingParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el responsable de pricing de NZT Studio, un estudio que construye y vende MVPs a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: a partir de la especificación de un MVP, proponer un precio concreto, realista y vendible para ese negocio.

Reglas:
- Trabaja en EUROS (€). Precios realistas para una pyme local española, no tarifas de agencia enterprise.
- Distingue el precio de CONSTRUCCIÓN (pago único) del MANTENIMIENTO mensual (hosting, soporte, pequeños cambios).
- Ofrece 2-3 planes (tiers) claros y diferenciados (p. ej. "Esencial", "Profesional", "Premium"), cada uno con lo que incluye. Marca cuál recomiendas.
- El precio debe ser coherente con el alcance, la complejidad y el tiempo estimado del MVP.
- Además del modelo de pago único, propón SIEMPRE una perspectiva alternativa de SUSCRIPCIÓN MENSUAL (modelo SaaS): en vez de cobrar la construcción de golpe, el negocio paga una cuota mensual recurrente que incluye el producto + hosting + soporte + pequeñas mejoras. Calcula una cuota mensual sensata, una opción anual con descuento si procede, una posible cuota de alta reducida, el compromiso mínimo en meses, qué incluye, y en cuántos meses la suscripción iguala el precio del pago único (break-even).
- Sé concreto: nada de "depende" ni rangos enormes. Da cifras.
- Escribe en español.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "currency": "EUR",
  "setupPrice": number,          // precio único de construcción del MVP, en euros (entero)
  "monthlyPrice": number | null, // cuota mensual de mantenimiento en euros (entero) o null si no aplica
  "tiers": [
    {
      "name": "string",          // nombre del plan
      "price": number,           // precio del plan en euros (entero)
      "billing": "one-time | monthly",
      "description": "string",   // a quién va dirigido / qué resuelve
      "features": ["string"]     // qué incluye el plan
    }
  ],
  "recommendedTier": "string",   // nombre del plan recomendado
  "paymentTerms": "string",      // condiciones de pago (e.g. "50% al inicio, 50% a la entrega")
  "rationale": "string",         // por qué este precio es justo y vendible para este negocio
  "assumptions": ["string"],     // supuestos sobre los que se basa el precio
  "saasModel": {                 // perspectiva de suscripción mensual (modelo SaaS)
    "monthlyPrice": number,           // cuota mensual recurrente todo-incluido, en euros (entero)
    "annualPrice": number | null,     // precio anual con descuento en euros (entero) o null
    "setupFee": number | null,        // cuota de alta reducida bajo suscripción, en euros (entero) o null
    "minimumTermMonths": number | null, // compromiso mínimo en meses o null
    "includedServices": ["string"],   // qué incluye la cuota mensual (producto, hosting, soporte, mejoras...)
    "breakEvenMonths": number | null, // en cuántos meses la suscripción iguala el pago único o null
    "rationale": "string"             // por qué la suscripción tiene sentido (o no) para este negocio
  }
}`;

function buildUserPrompt(input: PricingInput): string {
  const lines: string[] = [
    `Propón el pricing para este MVP.`,
    ``,
    `NEGOCIO:`,
    `- Nombre: ${input.businessName}`,
  ];
  if (input.businessSummary) lines.push(`- Contexto: ${input.businessSummary}`);
  lines.push(
    ``,
    `MVP:`,
    `- Pitch: ${input.pitch}`,
    `- Solución: ${input.solution}`,
    `- Usuario objetivo: ${input.targetUser}`
  );
  if (input.coreFeatures.length > 0) {
    lines.push(`- Features del MVP:`, ...input.coreFeatures.map((f) => `  · ${f}`));
  }
  if (input.techStack.length > 0) {
    lines.push(`- Stack: ${input.techStack.join(", ")}`);
  }
  if (input.timeline) lines.push(`- Tiempo estimado: ${input.timeline}`);
  if (input.complexity) lines.push(`- Complejidad: ${input.complexity}`);
  lines.push(``, `Devuelve el pricing en el formato JSON indicado.`);
  return lines.join("\n");
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GeneratePricingResult {
  output: PricingOutput;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Generates structured pricing for an MVP spec using the configured provider.
 * Throws MissingApiKeyError / AiApiError / PricingParseError on failure.
 */
export async function generatePricing(input: PricingInput): Promise<GeneratePricingResult> {
  const provider = await getModuleProvider("pricing-studio");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 6000,
  });

  const output = parsePricing(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parsePricing(text: string): PricingOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new PricingParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new PricingParseError("No se pudo interpretar la respuesta de la IA.");
  }

  return normalizeOutput(parsed);
}

function normalizeOutput(value: unknown): PricingOutput {
  if (typeof value !== "object" || value === null) {
    throw new PricingParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = value as Record<string, unknown>;

  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const output: PricingOutput = {
    currency: str(o.currency) || "EUR",
    setupPrice: toNumber(o.setupPrice),
    monthlyPrice: toNullableNumber(o.monthlyPrice),
    tiers: toTiers(o.tiers),
    recommendedTier: typeof o.recommendedTier === "string" ? o.recommendedTier : null,
    paymentTerms: str(o.paymentTerms),
    rationale: str(o.rationale),
    assumptions: toStringArray(o.assumptions),
    saasModel: toSaasModel(o.saasModel),
  };

  if (output.setupPrice <= 0 && output.tiers.length === 0) {
    throw new PricingParseError("La IA no produjo un pricing utilizable.");
  }
  return output;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = toNumber(value);
  return n > 0 ? n : null;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toSaasModel(value: unknown): SaasModel | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  const monthlyPrice = toNumber(r.monthlyPrice);
  if (monthlyPrice <= 0) return null;
  return {
    monthlyPrice,
    annualPrice: toNullableNumber(r.annualPrice),
    setupFee: toNullableNumber(r.setupFee),
    minimumTermMonths: toNullableNumber(r.minimumTermMonths),
    includedServices: toStringArray(r.includedServices),
    breakEvenMonths: toNullableNumber(r.breakEvenMonths),
    rationale: typeof r.rationale === "string" ? r.rationale : "",
  };
}

function toTiers(value: unknown): PricingTier[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => {
      if (typeof t !== "object" || t === null) return null;
      const r = t as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      if (!name) return null;
      return {
        name,
        price: toNumber(r.price),
        billing: typeof r.billing === "string" ? r.billing : "one-time",
        description: typeof r.description === "string" ? r.description : "",
        features: toStringArray(r.features),
      };
    })
    .filter((t): t is PricingTier => t !== null);
}
