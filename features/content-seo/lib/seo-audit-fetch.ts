// features/content-seo/lib/seo-audit-fetch.ts
// Extended SEO technical audit — single HTTP fetch to a page (plus light
// robots.txt/sitemap.xml checks) and a much deeper HTML analysis than the
// Rastreador's web-audit (used for the digital-presence score on PlaceCache).
//
// No external SEO APIs: everything is derived from the HTML/headers received.
// Server-only: performs outbound network requests.
import "server-only";

import {
  fetchWithTimeout,
  isSafePublicUrl,
  normalizeUrl,
  readCapped,
} from "@/features/rastreador/lib/web-audit";
import type { SeoIssue, SeoTechnicalData } from "@/features/content-seo/types";

const FETCH_TIMEOUT_MS = 10_000;
/** Más generoso que el audit del Rastreador: necesitamos todo el <body> para contar enlaces/imágenes/palabras. */
const MAX_HTML_BYTES = 1_500_000;
const AUX_FETCH_TIMEOUT_MS = 5_000;

const SEVERITY_PENALTY: Record<SeoIssue["severity"], number> = {
  high: 20,
  medium: 10,
  low: 5,
};

const ANALYTICS_PATTERNS = [
  "googletagmanager.com",
  "google-analytics.com",
  "gtag(",
  "ga('create'",
  "fbq(",
  "connect.facebook.net",
  "matomo",
  "plausible.io",
  "hotjar",
  "clarity.ms",
];

/**
 * Audita técnicamente una URL: HTTPS, viewport, title/meta/canonical/robots,
 * Open Graph/Twitter Cards, datos estructurados, jerarquía de encabezados,
 * imágenes sin alt, enlaces internos/externos, recuento de palabras,
 * analítica, favicon, robots.txt y sitemap.xml.
 *
 * Nunca lanza: cualquier fallo de red devuelve un resultado con reachable=false.
 */
export async function runSeoPageAudit(rawUrl: string): Promise<SeoTechnicalData> {
  const url = normalizeUrl(rawUrl);

  if (!isSafePublicUrl(url)) {
    return unreachableResult(url);
  }

  const startedAt = Date.now();

  let response: Response;
  let html: string;
  try {
    response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    html = await readCapped(response, MAX_HTML_BYTES);
  } catch {
    return unreachableResult(url);
  }

  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    return unreachableResult(url, response.status, response.url || null, responseTimeMs);
  }

  const finalUrl = response.url || url;
  const lower = html.toLowerCase();

  const usesHttps = finalUrl.startsWith("https://");
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const lang = extractAttr(html, /<html[^>]*\slang=["']([^"']+)["']/i);

  const title = extractTitle(html);
  const metaDescription = extractMetaContent(html, "description");
  const canonicalUrl = extractLinkHref(html, "canonical");
  const robotsMeta = extractMetaContent(html, "robots");

  const hasOgTags = /<meta[^>]+property=["']og:/i.test(html);
  const hasTwitterCard = /<meta[^>]+name=["']twitter:/i.test(html);
  const structuredDataTypes = extractStructuredDataTypes(html);
  const hasStructuredData = structuredDataTypes.length > 0;

  const h1Texts = extractHeadingTexts(html, "h1");
  const h2Count = countTags(html, "h2");

  const { imageCount, imagesMissingAlt } = countImages(html);
  const { internalLinkCount, externalLinkCount } = countLinks(html, finalUrl);
  const wordCount = countWords(html);

  const hasAnalytics = ANALYTICS_PATTERNS.some((p) => lower.includes(p));
  const hasFavicon = /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html);
  const copyrightYear = extractCopyrightYear(html);

  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    auxResourceExists(finalUrl, "/robots.txt"),
    auxResourceExists(finalUrl, "/sitemap.xml"),
  ]);

  const checks = {
    usesHttps,
    hasViewport,
    lang,
    title,
    metaDescription,
    canonicalUrl,
    robotsMeta,
    hasOgTags,
    hasTwitterCard,
    hasStructuredData,
    structuredDataTypes,
    h1Count: h1Texts.length,
    h1Texts,
    h2Count,
    imageCount,
    imagesMissingAlt,
    internalLinkCount,
    externalLinkCount,
    wordCount,
    hasAnalytics,
    hasFavicon,
    hasRobotsTxt,
    hasSitemap,
    copyrightYear,
  };

  const issues = buildIssues(checks, responseTimeMs);

  return {
    url,
    finalUrl,
    reachable: true,
    httpStatus: response.status,
    responseTimeMs,
    pageSizeBytes: byteLength(html),
    titleLength: title?.length ?? 0,
    metaDescriptionLength: metaDescription?.length ?? 0,
    ...checks,
    issues,
    score: computeAuditScore(issues),
    auditedAt: new Date().toISOString(),
  };
}

// ─── Issue derivation ─────────────────────────────────────────────────────────

interface AuditChecks {
  usesHttps: boolean;
  hasViewport: boolean;
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  hasOgTags: boolean;
  hasTwitterCard: boolean;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  h1Count: number;
  h1Texts: string[];
  h2Count: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinkCount: number;
  externalLinkCount: number;
  wordCount: number;
  hasAnalytics: boolean;
  hasFavicon: boolean;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  copyrightYear: number | null;
}

function buildIssues(checks: AuditChecks, responseTimeMs: number): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const currentYear = new Date().getFullYear();

  if (!checks.usesHttps) {
    issues.push({
      id: "no_https",
      label: "Sin conexión segura (HTTPS)",
      severity: "high",
      detail: "La web se sirve sin cifrado. Los navegadores la marcan como «No segura» y Google penaliza el posicionamiento.",
    });
  }
  if (!checks.hasViewport) {
    issues.push({
      id: "not_mobile_ready",
      label: "No adaptada a móvil",
      severity: "high",
      detail: "Falta la etiqueta meta viewport: en móvil la página se muestra en miniatura, como en escritorio.",
    });
  }
  if (!checks.title || checks.title.trim().length < 10) {
    issues.push({
      id: "missing_title",
      label: "Título ausente o demasiado corto",
      severity: "high",
      detail: "El <title> es el elemento más importante para el SEO on-page y lo primero que se ve en los resultados de búsqueda.",
    });
  } else if (checks.title.length > 60) {
    issues.push({
      id: "title_too_long",
      label: `Título demasiado largo (${checks.title.length} caracteres)`,
      severity: "low",
      detail: "Google trunca los títulos de más de ~60 caracteres en los resultados de búsqueda.",
    });
  }
  if (!checks.metaDescription) {
    issues.push({
      id: "missing_meta_description",
      label: "Sin meta description",
      severity: "medium",
      detail: "Sin meta description, Google genera un fragmento automático en los resultados, perdiendo control sobre el mensaje.",
    });
  } else if (checks.metaDescription.length > 160) {
    issues.push({
      id: "meta_description_too_long",
      label: `Meta description demasiado larga (${checks.metaDescription.length} caracteres)`,
      severity: "low",
      detail: "Las descripciones de más de ~160 caracteres se truncan en los resultados de búsqueda.",
    });
  }
  if (checks.h1Count === 0) {
    issues.push({
      id: "missing_h1",
      label: "Sin etiqueta H1",
      severity: "medium",
      detail: "El H1 ayuda a buscadores y usuarios a entender de qué trata la página. No se ha encontrado ninguno.",
    });
  } else if (checks.h1Count > 1) {
    issues.push({
      id: "multiple_h1",
      label: `Varias etiquetas H1 (${checks.h1Count})`,
      severity: "low",
      detail: "Tener varios H1 diluye la jerarquía semántica de la página. Lo ideal es un único H1 por página.",
    });
  }
  if (!checks.canonicalUrl) {
    issues.push({
      id: "missing_canonical",
      label: "Sin URL canónica",
      severity: "low",
      detail: "Sin etiqueta canonical, Google puede indexar versiones duplicadas de la misma página (con/sin barra final, parámetros, etc.).",
    });
  }
  if (checks.robotsMeta && /noindex/i.test(checks.robotsMeta)) {
    issues.push({
      id: "noindex",
      label: "Página marcada como noindex",
      severity: "high",
      detail: "La etiqueta meta robots indica «noindex»: Google no indexará esta página, no aparecerá en resultados de búsqueda.",
    });
  }
  if (!checks.hasOgTags || !checks.hasTwitterCard) {
    issues.push({
      id: "missing_social_tags",
      label: "Vista previa social incompleta",
      severity: "low",
      detail: "Faltan etiquetas Open Graph y/o Twitter Card: al compartir el enlace en redes o WhatsApp no se mostrará una vista previa atractiva.",
    });
  }
  if (!checks.hasStructuredData) {
    issues.push({
      id: "missing_structured_data",
      label: "Sin datos estructurados (Schema.org)",
      severity: "medium",
      detail: "Sin marcado JSON-LD, la página pierde la opción de aparecer con resultados enriquecidos (rich snippets) en Google.",
    });
  }
  if (checks.imageCount > 0 && checks.imagesMissingAlt > 0) {
    issues.push({
      id: "images_missing_alt",
      label: `${checks.imagesMissingAlt} de ${checks.imageCount} imágenes sin texto alternativo`,
      severity: checks.imagesMissingAlt === checks.imageCount ? "medium" : "low",
      detail: "El texto alternativo (alt) ayuda a SEO de imágenes y a la accesibilidad. Las imágenes sin alt no aportan contexto a los buscadores.",
    });
  }
  if (checks.wordCount < 300) {
    issues.push({
      id: "thin_content",
      label: `Contenido escaso (${checks.wordCount} palabras)`,
      severity: "medium",
      detail: "Páginas con menos de ~300 palabras suelen considerarse «contenido fino» y posicionan peor para términos relevantes.",
    });
  }
  if (!checks.hasAnalytics) {
    issues.push({
      id: "no_analytics",
      label: "Sin analítica instalada",
      severity: "medium",
      detail: "No se detecta Google Analytics ni similar: no hay datos de tráfico, fuentes de visita ni comportamiento de usuarios.",
    });
  }
  if (!checks.hasFavicon) {
    issues.push({
      id: "missing_favicon",
      label: "Sin favicon",
      severity: "low",
      detail: "La página no declara un icono de pestaña (favicon), lo que da una impresión menos profesional en pestañas y marcadores.",
    });
  }
  if (!checks.hasRobotsTxt) {
    issues.push({
      id: "missing_robots_txt",
      label: "Sin archivo robots.txt",
      severity: "low",
      detail: "robots.txt indica a los buscadores qué pueden rastrear. Su ausencia no es crítica, pero es una buena práctica tenerlo.",
    });
  }
  if (!checks.hasSitemap) {
    issues.push({
      id: "missing_sitemap",
      label: "Sin sitemap.xml",
      severity: "medium",
      detail: "Un sitemap.xml ayuda a los buscadores a descubrir e indexar todas las páginas del sitio de forma eficiente.",
    });
  }
  if (checks.copyrightYear !== null && checks.copyrightYear < currentYear - 1) {
    issues.push({
      id: "outdated_copyright",
      label: `Web sin actualizar desde ${checks.copyrightYear}`,
      severity: "low",
      detail: `El aviso de copyright indica ${checks.copyrightYear}: transmite abandono y hace dudar de si la información sigue vigente.`,
    });
  }
  if (responseTimeMs > 4000) {
    issues.push({
      id: "slow_response",
      label: "Carga lenta",
      severity: "medium",
      detail: `La página tardó ${(responseTimeMs / 1000).toFixed(1)}s en responder. Más de la mitad de los usuarios abandona una web que tarda más de 3 segundos.`,
    });
  }
  if (checks.internalLinkCount === 0) {
    issues.push({
      id: "no_internal_links",
      label: "Sin enlaces internos",
      severity: "low",
      detail: "No se detectan enlaces a otras páginas del mismo sitio: dificulta la navegación y la distribución de autoridad SEO entre páginas.",
    });
  }

  return issues;
}

function computeAuditScore(issues: SeoIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
  return Math.max(0, 100 - penalty);
}

// ─── HTML parsing helpers ───────────────────────────────────────────────────

function extractAttr(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match ? match[1].trim() || null : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  if (!match) return null;
  const text = match[1].replace(/\s+/g, " ").trim();
  return text || null;
}

function extractMetaContent(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const reReversed = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  const match = html.match(re) ?? html.match(reReversed);
  if (!match) return null;
  const text = match[1].replace(/\s+/g, " ").trim();
  return text || null;
}

function extractLinkHref(html: string, rel: string): string | null {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*href=["']([^"']*)["']`, "i");
  const reReversed = new RegExp(`<link[^>]+href=["']([^"']*)["'][^>]*rel=["']${rel}["']`, "i");
  const match = html.match(re) ?? html.match(reReversed);
  return match ? match[1].trim() || null : null;
}

function extractStructuredDataTypes(html: string): string[] {
  const types = new Set<string>();
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of blocks) {
    try {
      const json = JSON.parse(block[1].trim());
      collectSchemaTypes(json, types);
    } catch {
      // JSON-LD malformado: lo ignoramos sin romper el resto del análisis
    }
  }
  return [...types];
}

function collectSchemaTypes(value: unknown, types: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSchemaTypes(item, types);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const obj = value as Record<string, unknown>;
  const type = obj["@type"];
  if (typeof type === "string") types.add(type);
  else if (Array.isArray(type)) for (const t of type) if (typeof t === "string") types.add(t);
  if (Array.isArray(obj["@graph"])) collectSchemaTypes(obj["@graph"], types);
}

function extractHeadingTexts(html: string, tag: "h1" | "h2"): string[] {
  const matches = html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"));
  const texts: string[] = [];
  for (const m of matches) {
    const text = m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) texts.push(text);
  }
  return texts;
}

function countTags(html: string, tag: string): number {
  const matches = html.match(new RegExp(`<${tag}[^>]*>`, "gi"));
  return matches ? matches.length : 0;
}

function countImages(html: string): { imageCount: number; imagesMissingAlt: number } {
  const matches = [...html.matchAll(/<img\b[^>]*>/gi)];
  let missingAlt = 0;
  for (const m of matches) {
    const tag = m[0];
    const altMatch = tag.match(/\salt=["']([^"']*)["']/i);
    if (!altMatch || altMatch[1].trim() === "") missingAlt++;
  }
  return { imageCount: matches.length, imagesMissingAlt: missingAlt };
}

function countLinks(html: string, baseUrl: string): { internalLinkCount: number; externalLinkCount: number } {
  let host: string | null = null;
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    host = null;
  }

  const matches = [...html.matchAll(/<a\b[^>]*\shref=["']([^"'#][^"']*)["']/gi)];
  let internal = 0;
  let external = 0;

  for (const m of matches) {
    const href = m[1].trim();
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;

    if (href.startsWith("/") || href.startsWith("./") || href.startsWith("../") || !/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      internal++;
      continue;
    }

    try {
      const linkHost = new URL(href).hostname.replace(/^www\./, "");
      if (host && linkHost === host) internal++;
      else external++;
    } catch {
      internal++;
    }
  }

  return { internalLinkCount: internal, externalLinkCount: external };
}

function countWords(html: string): number {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ");
  const words = withoutScripts.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}

function extractCopyrightYear(html: string): number | null {
  const matches = html.matchAll(/(?:©|&copy;|copyright)[^0-9<]{0,40}(20\d{2})/gi);
  let latest: number | null = null;
  for (const m of matches) {
    const year = parseInt(m[1], 10);
    if (latest === null || year > latest) latest = year;
  }
  return latest;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Comprueba si /robots.txt o /sitemap.xml existen en el dominio (HEAD/GET corto, sin afectar al score si fallan por timeout). */
async function auxResourceExists(baseUrl: string, path: string): Promise<boolean> {
  try {
    const url = new URL(path, baseUrl).toString();
    if (!isSafePublicUrl(url)) return false;
    const response = await fetchWithTimeout(url, AUX_FETCH_TIMEOUT_MS);
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Unreachable result ───────────────────────────────────────────────────────

function unreachableResult(
  url: string,
  httpStatus: number | null = null,
  finalUrl: string | null = null,
  responseTimeMs: number | null = null
): SeoTechnicalData {
  return {
    url,
    finalUrl,
    reachable: false,
    httpStatus,
    responseTimeMs,
    pageSizeBytes: null,
    usesHttps: false,
    hasViewport: false,
    lang: null,
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    canonicalUrl: null,
    robotsMeta: null,
    hasOgTags: false,
    hasTwitterCard: false,
    hasStructuredData: false,
    structuredDataTypes: [],
    h1Count: 0,
    h1Texts: [],
    h2Count: 0,
    imageCount: 0,
    imagesMissingAlt: 0,
    internalLinkCount: 0,
    externalLinkCount: 0,
    wordCount: 0,
    hasAnalytics: false,
    hasFavicon: false,
    hasRobotsTxt: false,
    hasSitemap: false,
    copyrightYear: null,
    issues: [
      {
        id: "unreachable",
        label: httpStatus ? `La página responde con error ${httpStatus}` : "La página no responde",
        severity: "high",
        detail: httpStatus
          ? `La URL devuelve un error ${httpStatus}: no se puede auditar el contenido.`
          : "No se pudo conectar con la URL indicada: comprueba que es correcta y accesible públicamente.",
      },
    ],
    score: 0,
    auditedAt: new Date().toISOString(),
  };
}
