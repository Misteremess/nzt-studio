// features/content-seo/lib/claude.ts
// Server-only AI integration for the Content/SEO Agent.
//
// Generates a content plan (post ideas with angle, keywords, format) and a
// landing page copy draft for an analyzed business, informed by the web
// audit findings from the Rastreador. Routes to whichever provider
// (Anthropic / Gemini) is configured for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type {
  ContentPlanInput,
  ContentPlanOutput,
  ContentTopic,
  LandingCopy,
  SeoAuditInput,
  SeoCategoryReport,
  SeoFinding,
  SeoKeywordOpportunity,
  SeoReportOutput,
} from "@/features/content-seo/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class ContentSeoParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentSeoParseError";
  }
}

const SYSTEM_PROMPT = `Eres un estratega de marketing de contenidos y SEO de NZT Studio, un estudio que construye y vende MVPs y agentes de IA a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: a partir de la información de un negocio ya analizado, genera:
1. Un plan de contenidos: 5-7 ideas de publicaciones (blog, redes sociales, vídeo) con título, ángulo/enfoque, palabras clave objetivo (2-4 por idea) y formato sugerido.
2. Un borrador de copy para la landing page del negocio: titular (headline), subtitular (subheadline), texto del botón de llamada a la acción (CTA) y 3-5 bullets de beneficios.
3. Notas SEO: 3-6 recomendaciones concretas de mejora SEO, basadas en los problemas detectados en la auditoría web (si los hay) y en buenas prácticas generales para el sector del negocio.

Reglas:
- Escribe en español, tono profesional y orientado a resultados para un negocio local.
- Sé concreto y específico al sector y contexto del negocio — nada de relleno genérico.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "topics": [{ "title": "string", "angle": "string", "keywords": ["string", ...], "format": "string" }, ...],
  "landingCopy": { "headline": "string", "subheadline": "string", "ctaLabel": "string", "bullets": ["string", ...] },
  "seoNotes": ["string", ...]
}`;

function buildUserPrompt(input: ContentPlanInput): string {
  return [
    `NEGOCIO: ${input.businessName}`,
    input.primaryType ? `TIPO: ${input.primaryType}` : null,
    `RESUMEN DEL ANÁLISIS:`,
    input.summary,
    input.seoIssues.length > 0
      ? [`PROBLEMAS DETECTADOS EN LA AUDITORÍA WEB:`, ...input.seoIssues.map((i) => `- ${i}`)].join("\n")
      : `No se detectaron problemas en la auditoría web (o no se realizó).`,
    ``,
    `Genera el plan de contenidos, el copy de landing y las notas SEO en el formato JSON indicado.`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export interface GenerateContentPlanResult {
  output: ContentPlanOutput;
  raw: unknown;
  model: string;
}

export async function generateContentPlan(input: ContentPlanInput): Promise<GenerateContentPlanResult> {
  const provider = await getModuleProvider("content-seo");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input),
    maxTokens: 3500,
  });

  const output = parseContentPlan(text);
  return { output, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseContentPlan(text: string): ContentPlanOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ContentSeoParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ContentSeoParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ContentSeoParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const topics = toTopics(o.topics);
  const landingCopy = toLandingCopy(o.landingCopy);
  const seoNotes = toStringArray(o.seoNotes);

  if (topics.length === 0 && !landingCopy.headline) {
    throw new ContentSeoParseError("La IA no produjo un plan de contenidos utilizable.");
  }

  return { topics, landingCopy, seoNotes };
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toTopics(value: unknown): ContentTopic[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      const angle = typeof r.angle === "string" ? r.angle : "";
      const format = typeof r.format === "string" ? r.format : "";
      const keywords = toStringArray(r.keywords);
      if (!title) return null;
      return { title, angle, keywords, format };
    })
    .filter((t): t is ContentTopic => t !== null);
}

function toLandingCopy(value: unknown): LandingCopy {
  const empty: LandingCopy = { headline: "", subheadline: "", ctaLabel: "", bullets: [] };
  if (typeof value !== "object" || value === null) return empty;
  const r = value as Record<string, unknown>;
  return {
    headline: typeof r.headline === "string" ? r.headline : "",
    subheadline: typeof r.subheadline === "string" ? r.subheadline : "",
    ctaLabel: typeof r.ctaLabel === "string" ? r.ctaLabel : "",
    bullets: toStringArray(r.bullets),
  };
}

// ─── SEO Audit (URL-based) ──────────────────────────────────────────────────

const SEO_REPORT_SYSTEM_PROMPT = `Eres un consultor SEO senior de NZT Studio que realiza auditorías profesionales de páginas web para pequeños y medianos negocios (principalmente en España).

Se te proporcionan datos técnicos extraídos automáticamente de una página (HTTPS, meta tags, encabezados, datos estructurados, enlaces, imágenes, velocidad, robots.txt/sitemap, etc.) mediante un fetch directo a la URL. A partir de esos datos, redacta una AUDITORÍA SEO COMPLETA Y MUY ELABORADA, profesional, lista para presentar a un cliente.

Estructura tu análisis en estas categorías (incluye SIEMPRE estas 4, en este orden):
1. "SEO técnico" — HTTPS, velocidad, indexabilidad (robots, canonical, sitemap), datos estructurados, favicon.
2. "SEO on-page" — title, meta description, encabezados (H1/H2), densidad e idoneidad del contenido, palabras clave aparentes.
3. "Contenido y experiencia de usuario" — volumen y calidad del contenido, imágenes (alt), enlaces internos, adaptación móvil.
4. "Visibilidad y compartibilidad" — Open Graph/Twitter Cards, analítica instalada, actualidad de la web (copyright).

Para cada categoría:
- Asigna un "score" de 0 a 100 (tu propia valoración cualitativa, puede diferir del score técnico bruto si el contexto lo justifica).
- Incluye 2-5 "findings": cada uno con "title" (corto), "status" ("ok" | "warning" | "critical"), "description" (qué se ha encontrado, con datos concretos cuando existan) y "recommendation" (acción concreta y accionable, no genérica).

Además, genera:
- "executiveSummary": 3-5 frases resumiendo el estado general de la web, su impacto en el negocio y la prioridad de actuación.
- "overallScore": 0-100, tu valoración global (puedes ajustar el score técnico bruto según el contexto del negocio).
- "quickWins": 3-6 acciones de bajo esfuerzo y alto impacto, ordenadas por prioridad.
- "longTermActions": 3-6 acciones estratégicas a medio/largo plazo (contenido, autoridad, rendimiento).
- "keywordOpportunities": 3-6 oportunidades de palabras clave razonables para el sector/tipo de negocio inferido del contenido (cada una con "keyword", "intent" — informacional/transaccional/local — y "suggestion" sobre cómo aprovecharla).

Reglas:
- Escribe en español, tono profesional, concreto y orientado a negocio — nada de relleno genérico ni frases vacías.
- Usa los datos técnicos proporcionados como evidencia; no inventes datos que no se puedan inferir (no inventes tráfico, posiciones en Google, backlinks, etc.).
- Si la página no es accesible (reachable=false), dedica el resumen ejecutivo y los quick wins a explicar el problema de accesibilidad como prioridad máxima, y reduce el resto de categorías a hallazgos genéricos de buenas prácticas.
- Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "executiveSummary": "string",
  "overallScore": number,
  "categories": [
    { "name": "string", "score": number, "findings": [{ "title": "string", "status": "ok"|"warning"|"critical", "description": "string", "recommendation": "string" }, ...] },
    ...
  ],
  "quickWins": ["string", ...],
  "longTermActions": ["string", ...],
  "keywordOpportunities": [{ "keyword": "string", "intent": "string", "suggestion": "string" }, ...]
}`;

function buildSeoUserPrompt(input: SeoAuditInput): string {
  const t = input.technical;
  const lines = [
    `URL AUDITADA: ${t.url}`,
    t.finalUrl && t.finalUrl !== t.url ? `URL FINAL (tras redirecciones): ${t.finalUrl}` : null,
    input.businessName ? `NEGOCIO: ${input.businessName}` : null,
    ``,
    `DATOS TÉCNICOS EXTRAÍDOS:`,
    `- Accesible: ${t.reachable ? "sí" : "no"}${t.httpStatus ? ` (HTTP ${t.httpStatus})` : ""}`,
    `- Tiempo de respuesta: ${t.responseTimeMs !== null ? `${t.responseTimeMs} ms` : "desconocido"}`,
    `- Tamaño de página: ${t.pageSizeBytes !== null ? `${Math.round(t.pageSizeBytes / 1024)} KB` : "desconocido"}`,
    `- HTTPS: ${t.usesHttps ? "sí" : "no"}`,
    `- Meta viewport (adaptación móvil): ${t.hasViewport ? "sí" : "no"}`,
    `- Idioma declarado (lang): ${t.lang ?? "no declarado"}`,
    `- Title (${t.titleLength} caracteres): ${t.title ?? "(ausente)"}`,
    `- Meta description (${t.metaDescriptionLength} caracteres): ${t.metaDescription ?? "(ausente)"}`,
    `- URL canónica: ${t.canonicalUrl ?? "no declarada"}`,
    `- Meta robots: ${t.robotsMeta ?? "no declarado"}`,
    `- H1 (${t.h1Count}): ${t.h1Texts.length > 0 ? t.h1Texts.join(" | ") : "(ninguno)"}`,
    `- H2: ${t.h2Count}`,
    `- Open Graph: ${t.hasOgTags ? "sí" : "no"} · Twitter Card: ${t.hasTwitterCard ? "sí" : "no"}`,
    `- Datos estructurados (Schema.org): ${t.hasStructuredData ? `sí (${t.structuredDataTypes.join(", ")})` : "no"}`,
    `- Imágenes: ${t.imageCount} (sin alt: ${t.imagesMissingAlt})`,
    `- Enlaces internos: ${t.internalLinkCount} · Enlaces externos: ${t.externalLinkCount}`,
    `- Recuento de palabras (texto visible aprox.): ${t.wordCount}`,
    `- Analítica instalada: ${t.hasAnalytics ? "sí" : "no"}`,
    `- Favicon: ${t.hasFavicon ? "sí" : "no"}`,
    `- robots.txt: ${t.hasRobotsTxt ? "sí" : "no"} · sitemap.xml: ${t.hasSitemap ? "sí" : "no"}`,
    `- Año de copyright detectado: ${t.copyrightYear ?? "no detectado"}`,
    `- Score técnico bruto: ${t.score}/100`,
    ``,
    `PROBLEMAS DETECTADOS AUTOMÁTICAMENTE:`,
    ...(t.issues.length > 0 ? t.issues.map((i) => `- [${i.severity}] ${i.label}: ${i.detail}`) : ["(ninguno)"]),
    ``,
    `Genera la auditoría SEO completa en el formato JSON indicado.`,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

export interface GenerateSeoReportResult {
  output: SeoReportOutput;
  raw: unknown;
  model: string;
}

export async function generateSeoReport(input: SeoAuditInput): Promise<GenerateSeoReportResult> {
  const provider = await getModuleProvider("content-seo");
  const { text, raw, model } = await generateText(provider, {
    system: SEO_REPORT_SYSTEM_PROMPT,
    user: buildSeoUserPrompt(input),
    maxTokens: 16000,
  });

  const output = parseSeoReport(text);
  return { output, raw, model };
}

function parseSeoReport(text: string): SeoReportOutput {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new ContentSeoParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ContentSeoParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new ContentSeoParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const categories = toCategories(o.categories);
  const executiveSummary = typeof o.executiveSummary === "string" ? o.executiveSummary : "";

  if (categories.length === 0 && !executiveSummary) {
    throw new ContentSeoParseError("La IA no produjo una auditoría SEO utilizable.");
  }

  return {
    executiveSummary,
    overallScore: typeof o.overallScore === "number" ? o.overallScore : 0,
    categories,
    quickWins: toStringArray(o.quickWins),
    longTermActions: toStringArray(o.longTermActions),
    keywordOpportunities: toKeywordOpportunities(o.keywordOpportunities),
  };
}

function toCategories(value: unknown): SeoCategoryReport[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : "";
      if (!name) return null;
      return {
        name,
        score: typeof r.score === "number" ? r.score : 0,
        findings: toFindings(r.findings),
      };
    })
    .filter((c): c is SeoCategoryReport => c !== null);
}

const FINDING_STATUSES: SeoFinding["status"][] = ["ok", "warning", "critical"];

function toFindings(value: unknown): SeoFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : "";
      if (!title) return null;
      const status = FINDING_STATUSES.includes(r.status as SeoFinding["status"])
        ? (r.status as SeoFinding["status"])
        : "warning";
      return {
        title,
        status,
        description: typeof r.description === "string" ? r.description : "",
        recommendation: typeof r.recommendation === "string" ? r.recommendation : "",
      };
    })
    .filter((f): f is SeoFinding => f !== null);
}

function toKeywordOpportunities(value: unknown): SeoKeywordOpportunity[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v !== "object" || v === null) return null;
      const r = v as Record<string, unknown>;
      const keyword = typeof r.keyword === "string" ? r.keyword : "";
      if (!keyword) return null;
      return {
        keyword,
        intent: typeof r.intent === "string" ? r.intent : "",
        suggestion: typeof r.suggestion === "string" ? r.suggestion : "",
      };
    })
    .filter((k): k is SeoKeywordOpportunity => k !== null);
}
