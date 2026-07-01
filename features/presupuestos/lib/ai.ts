// features/presupuestos/lib/ai.ts
// Server-only AI integration for the Presupuestos module.
//
// Turns a free-text description of what the client needs into a structured,
// professional budget draft (title, intro, itemized line items with realistic
// Spanish-market pricing, payment terms, notes). Routes to whichever provider
// (Anthropic / Gemini) is configured for the "presupuestos" module; the API key
// never leaves the server.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { BudgetDraft, BudgetItem } from "@/features/presupuestos/types";
import type { GenerateDraftInput } from "@/features/presupuestos/schemas";

/** Thrown when the model output cannot be parsed into a usable draft. */
export class BudgetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetParseError";
  }
}

const SYSTEM_PROMPT = `Eres el responsable de presupuestos de Hyperfocus, un estudio español que diseña y desarrolla webs, aplicaciones a medida, tiendas online y servicios digitales (SEO, branding, automatizaciones) para pequeños y medianos negocios.

Tu tarea: a partir de la descripción de lo que necesita un cliente, redactar un PRESUPUESTO profesional desglosado en partidas, con precios de mercado realistas en España (euros, SIN IVA — el IVA se añade después automáticamente).

Reglas:
- Escribe en español, con un tono profesional y claro.
- Desglosa el trabajo en partidas concretas y honestas (diseño, desarrollo, contenidos, SEO, mantenimiento, etc.), no en una sola línea genérica.
- Los precios (unitPrice) son POR UNIDAD y SIN IVA, en euros. Usa tarifas realistas para un estudio digital español (p. ej. una web corporativa sencilla 900–2.500 €, un e-commerce 2.500–7.000 €, mantenimiento mensual 30–120 €/mes).
- "quantity" es el número de unidades (normalmente 1; para mantenimiento mensual puedes usar los meses).
- Incluye condiciones de pago razonables (p. ej. 50% al inicio y 50% a la entrega) y una validez en días.
- No inventes datos del cliente ni datos fiscales. No incluyas el IVA en los precios.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "title": "string",            // título del presupuesto, p. ej. "Presupuesto — Web corporativa + tienda online"
  "intro": "string",            // 1-3 frases presentando el proyecto al cliente
  "items": [                    // partidas del presupuesto (2 a 12)
    {
      "concept": "string",      // nombre corto de la partida
      "description": "string",  // detalle de qué incluye (1-2 frases)
      "quantity": number,       // unidades (normalmente 1)
      "unitPrice": number       // precio por unidad en euros, SIN IVA
    }
  ],
  "paymentTerms": "string",     // condiciones de pago
  "notes": "string",            // notas u observaciones (opcional, puede ir vacío)
  "validityDays": number        // días de validez del presupuesto (p. ej. 30)
}`;

function buildUserPrompt(input: GenerateDraftInput): string {
  const lines = [
    "Redacta el presupuesto para lo siguiente:",
    "",
    input.prompt,
  ];
  if (input.clientName) {
    lines.push("", `Cliente: ${input.clientName} (no inventes sus datos fiscales).`);
  }
  lines.push("", "Devuelve solo el JSON con el formato indicado.");
  return lines.join("\n");
}

export interface GenerateBudgetResult {
  draft: BudgetDraft;
  raw: unknown;
  model: string;
}

/**
 * Generates a structured budget draft from a free-text brief using the
 * configured provider.
 * Throws MissingApiKeyError / AiApiError / BudgetParseError on failure.
 */
export async function generateBudgetDraft(
  input: GenerateDraftInput
): Promise<GenerateBudgetResult> {
  const provider = await getModuleProvider("presupuestos");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 6000,
  });

  const draft = parseDraft(text);
  return { draft, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseDraft(text: string): BudgetDraft {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new BudgetParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new BudgetParseError("No se pudo interpretar la respuesta de la IA.");
  }

  return normalizeDraft(parsed);
}

function normalizeDraft(value: unknown): BudgetDraft {
  if (typeof value !== "object" || value === null) {
    throw new BudgetParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = value as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  const items = normalizeItems(o.items);
  if (items.length === 0) {
    throw new BudgetParseError("La IA no produjo partidas utilizables.");
  }

  const validityRaw = num(o.validityDays);
  const validityDays = validityRaw >= 1 && validityRaw <= 365 ? Math.round(validityRaw) : 30;

  return {
    title: str(o.title) || "Presupuesto",
    intro: str(o.intro),
    items,
    notes: str(o.notes),
    paymentTerms: str(o.paymentTerms),
    validityDays,
  };
}

function normalizeItems(value: unknown): BudgetItem[] {
  if (!Array.isArray(value)) return [];
  const out: BudgetItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const concept = typeof r.concept === "string" ? r.concept.trim() : "";
    if (!concept) continue;
    const qtyRaw = typeof r.quantity === "number" ? r.quantity : Number(r.quantity);
    const priceRaw = typeof r.unitPrice === "number" ? r.unitPrice : Number(r.unitPrice);
    out.push({
      concept,
      description: typeof r.description === "string" ? r.description.trim() : "",
      quantity: Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1,
      unitPrice: Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : 0,
    });
  }
  return out.slice(0, 100);
}
