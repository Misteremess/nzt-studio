// features/rastreador/lib/web-audit.ts
// Auditoría automática de la web de un negocio — sin APIs externas.
//
// Hace UNA petición HTTP a la web del negocio y analiza el HTML recibido:
// HTTPS, adaptación a móvil, SEO básico, analítica, formulario de contacto
// y año de copyright. Cada fallo se convierte en un WebAuditIssue con una
// explicación apta para enseñar al cliente — son los argumentos de venta.
//
// Server-only: hace red saliente y nunca debe ejecutarse en el cliente.
import "server-only";

import type {
  WebAuditIssue,
  WebAuditResult,
  WebAuditSeverity,
} from "@/features/rastreador/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
/** Límite de HTML analizado — suficiente para <head> y la mayoría de páginas */
const MAX_HTML_BYTES = 500_000;

/** Penalización sobre 100 por severidad de cada issue */
const SEVERITY_PENALTY: Record<WebAuditSeverity, number> = {
  high: 25,
  medium: 15,
  low: 8,
};

/** Patrones de herramientas de analítica/marketing habituales */
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Audita la web de un negocio a partir de su websiteUri de Google Places.
 * Nunca lanza: cualquier fallo de red devuelve un resultado con reachable=false.
 */
export async function runWebAudit(websiteUri: string): Promise<WebAuditResult> {
  const url = normalizeUrl(websiteUri);
  const startedAt = Date.now();

  let response: Response;
  let html: string;
  try {
    response = await fetchWithTimeout(url);
    html = await readCapped(response);
  } catch {
    return unreachableResult(url);
  }

  const responseTimeMs = Date.now() - startedAt;

  if (!response.ok) {
    return unreachableResult(url, response.status, response.url || null, responseTimeMs);
  }

  const lower = html.toLowerCase();
  const finalUrl = response.url || url;

  const usesHttps = finalUrl.startsWith("https://");
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const title = extractTitle(html);
  const hasMetaDescription = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']+/i.test(html);
  const hasOgTags = /<meta[^>]+property=["']og:/i.test(html);
  const hasAnalytics = ANALYTICS_PATTERNS.some((p) => lower.includes(p));
  const hasContactForm = lower.includes("<form");
  const copyrightYear = extractCopyrightYear(html);

  const checks = {
    usesHttps,
    hasViewport,
    title,
    hasMetaDescription,
    hasOgTags,
    hasAnalytics,
    hasContactForm,
    copyrightYear,
  };

  const issues = buildIssues(checks, responseTimeMs);

  return {
    url,
    finalUrl,
    reachable: true,
    httpStatus: response.status,
    responseTimeMs,
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
  title: string | null;
  hasMetaDescription: boolean;
  hasOgTags: boolean;
  hasAnalytics: boolean;
  hasContactForm: boolean;
  copyrightYear: number | null;
}

function buildIssues(checks: AuditChecks, responseTimeMs: number): WebAuditIssue[] {
  const issues: WebAuditIssue[] = [];
  const currentYear = new Date().getFullYear();

  if (!checks.usesHttps) {
    issues.push({
      id: "no_https",
      label: "Sin conexión segura (HTTPS)",
      severity: "high",
      detail:
        "La web se sirve sin cifrado. Los navegadores la marcan como «No segura» y Google penaliza su posicionamiento.",
    });
  }

  if (!checks.hasViewport) {
    issues.push({
      id: "not_mobile_ready",
      label: "No adaptada a móvil",
      severity: "high",
      detail:
        "La página no declara meta viewport: en un móvil se ve como en un ordenador, en miniatura. La mayoría de las visitas locales llegan desde el móvil.",
    });
  }

  if (!checks.title || checks.title.trim().length < 5) {
    issues.push({
      id: "missing_title",
      label: "Título de página ausente o pobre",
      severity: "medium",
      detail:
        "El <title> es lo primero que muestra Google en los resultados de búsqueda. Sin él, el negocio pierde visibilidad y clics.",
    });
  }

  if (!checks.hasMetaDescription) {
    issues.push({
      id: "missing_meta_description",
      label: "Sin descripción para buscadores",
      severity: "medium",
      detail:
        "Falta la meta description: Google muestra un texto aleatorio de la página en lugar de un mensaje de venta controlado.",
    });
  }

  if (!checks.hasOgTags) {
    issues.push({
      id: "missing_og_tags",
      label: "Sin vista previa al compartir",
      severity: "low",
      detail:
        "Sin etiquetas Open Graph, al compartir la web por WhatsApp o redes sociales no aparece imagen ni título — el enlace parece poco fiable.",
    });
  }

  if (!checks.hasAnalytics) {
    issues.push({
      id: "no_analytics",
      label: "Sin analítica instalada",
      severity: "medium",
      detail:
        "No se detecta Google Analytics ni similar: el negocio no sabe cuántas visitas recibe ni de dónde vienen. Decide a ciegas.",
    });
  }

  if (!checks.hasContactForm) {
    issues.push({
      id: "no_contact_form",
      label: "Sin formulario de contacto",
      severity: "medium",
      detail:
        "La página no tiene ningún formulario: cada visita que no llama por teléfono es un cliente potencial perdido.",
    });
  }

  if (checks.copyrightYear !== null && checks.copyrightYear < currentYear - 1) {
    issues.push({
      id: "outdated_copyright",
      label: `Web sin actualizar desde ${checks.copyrightYear}`,
      severity: "medium",
      detail: `El aviso de copyright dice ${checks.copyrightYear}: transmite abandono y hace dudar de si los datos (horarios, precios) siguen vigentes.`,
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

  return issues;
}

/** Score 0-100: parte de 100 y resta la penalización de cada issue */
function computeAuditScore(issues: WebAuditIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
  return Math.max(0, 100 - penalty);
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        // UA de navegador real: bastantes webs de PYMEs bloquean UAs de bots
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Lee el body con un tope de bytes para no descargar páginas gigantes */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;

  while (bytes < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return html;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i);
  if (!match) return null;
  const text = match[1].replace(/\s+/g, " ").trim();
  return text || null;
}

/** Busca el año más reciente junto a un símbolo o palabra de copyright */
function extractCopyrightYear(html: string): number | null {
  const matches = html.matchAll(/(?:©|&copy;|copyright)[^0-9<]{0,40}(20\d{2})/gi);
  let latest: number | null = null;
  for (const m of matches) {
    const year = parseInt(m[1], 10);
    if (latest === null || year > latest) latest = year;
  }
  return latest;
}

// ─── Unreachable result ───────────────────────────────────────────────────────

function unreachableResult(
  url: string,
  httpStatus: number | null = null,
  finalUrl: string | null = null,
  responseTimeMs: number | null = null
): WebAuditResult {
  return {
    url,
    finalUrl,
    reachable: false,
    httpStatus,
    responseTimeMs,
    usesHttps: false,
    hasViewport: false,
    title: null,
    hasMetaDescription: false,
    hasOgTags: false,
    hasAnalytics: false,
    hasContactForm: false,
    copyrightYear: null,
    issues: [
      {
        id: "unreachable",
        label: httpStatus ? `La web responde con error ${httpStatus}` : "La web no responde",
        severity: "high",
        detail: httpStatus
          ? `La web devuelve un error ${httpStatus}: los clientes que la visitan se encuentran una página rota.`
          : "No se pudo conectar con la web del negocio: dominio caducado, hosting caído o dirección incorrecta en Google.",
      },
    ],
    score: 0,
    auditedAt: new Date().toISOString(),
  };
}
