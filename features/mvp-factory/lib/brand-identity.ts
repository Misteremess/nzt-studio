// features/mvp-factory/lib/brand-identity.ts
// Server-only extraction of a business's REAL visual identity (colors,
// typography, logo) so MVP mockups stop inventing generic palettes.
//
// Two entry points:
// - extractBrandIdentityFromWebsite: fetches the business's own site, pulls
//   color/font hints + a logo image from the raw HTML, and asks the
//   configured AI to turn that into a structured palette.
// - extractBrandIdentityFromImage: same structured extraction, but from a
//   user-supplied image (logo or design brief/inspiration screenshot).
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { BrandColor, BrandIdentityInput } from "@/features/mvp-factory/types";

/** Thrown when the model output cannot be parsed into the expected shape. */
export class BrandIdentityParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandIdentityParseError";
  }
}

/** Thrown when the business website cannot be fetched at all. */
export class WebsiteUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebsiteUnreachableError";
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 500_000;
const MAX_IMAGE_BYTES = 1_500_000; // ~1.5MB — generous for a logo/icon

/** Image media types the vision-capable models accept directly. */
const VISION_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// ─── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto en branding y diseño visual de un estudio de diseño de primer nivel.

Tu tarea: a partir de lo que se te proporciona sobre un negocio (imagen de su logo y/o pistas extraídas de su web, o una imagen de referencia/brief de diseño), deduce su identidad visual real y devuélvela como un sistema de diseño utilizable.

Reglas:
- Define una paleta de 4 a 6 colores con roles semánticos: "primary", "secondary", "accent", "background", "surface", "text" (usa los roles que tengan sentido según lo que veas; si no hay suficiente información para algún rol, omítelo en vez de inventarlo al azar).
- "background" y "surface" deben ser perceptiblemente distintos entre sí (para que las tarjetas se distingan del fondo).
- Si identificas tipografías reales (en el HTML o por el estilo del logo/imagen), propón un nombre de Google Font para títulos ("fontHeading") y otro para cuerpo de texto ("fontBody"); si no hay pistas suficientes, propón una pareja tipográfica coherente con el estilo visual que percibas.
- "styleNotes": 2-4 frases describiendo el tono/personalidad de marca (ej. "artesanal y cálido", "tecnológico y minimalista") y cualquier detalle visual distintivo a respetar.
- Responde EXCLUSIVAMENTE con un objeto JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
{
  "colors": [{ "role": "primary", "hex": "#RRGGBB", "label": "string opcional describiendo el color" }],
  "fontHeading": "string o null",
  "fontBody": "string o null",
  "styleNotes": "string"
}`;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExtractedBrandIdentity extends BrandIdentityInput {
  model: string;
}

/**
 * Fetches the business's own website, extracts color/font hints and a logo
 * image from the raw HTML, then asks the configured AI to turn that into a
 * structured brand identity.
 * Throws WebsiteUnreachableError / MissingApiKeyError / AiApiError / BrandIdentityParseError.
 */
export async function extractBrandIdentityFromWebsite(
  websiteUri: string
): Promise<ExtractedBrandIdentity> {
  const url = normalizeUrl(websiteUri);

  let html: string;
  let finalUrl: string;
  try {
    const response = await fetchWithTimeout(url, {
      Accept: "text/html,application/xhtml+xml",
    });
    if (!response.ok) {
      throw new WebsiteUnreachableError(`La web respondió con error ${response.status}.`);
    }
    finalUrl = response.url || url;
    html = await readCapped(response, MAX_HTML_BYTES);
  } catch (err) {
    if (err instanceof WebsiteUnreachableError) throw err;
    throw new WebsiteUnreachableError("No se pudo acceder a la web del negocio.");
  }

  const hints = extractHtmlHints(html, finalUrl);
  const logo = await tryDownloadLogo(hints.logoUrl);

  const provider = await getModuleProvider("mvp-factory");
  const { text, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildWebsiteUserPrompt(finalUrl, hints, logo),
    maxTokens: 1500,
    images: logo ? [{ data: logo.base64, mediaType: logo.mediaType }] : undefined,
  });

  const parsed = parseIdentityJson(text);
  return {
    source: "website",
    sourceUrl: finalUrl,
    colors: parsed.colors,
    fontHeading: parsed.fontHeading,
    fontBody: parsed.fontBody,
    styleNotes: parsed.styleNotes,
    logoImage: logo?.base64 ?? null,
    logoImageMime: logo?.mediaType ?? null,
    referenceImage: null,
    referenceImageMime: null,
    model,
  };
}

/**
 * Extracts a structured brand identity from a user-supplied image — either
 * the business's logo or a design brief/inspiration screenshot.
 * Throws MissingApiKeyError / AiApiError / BrandIdentityParseError.
 */
export async function extractBrandIdentityFromImage(
  base64: string,
  mediaType: string,
  kind: "logo" | "reference"
): Promise<ExtractedBrandIdentity> {
  if (!VISION_MEDIA_TYPES.has(mediaType)) {
    throw new BrandIdentityParseError(
      "Formato de imagen no soportado. Usa PNG, JPEG, WEBP o GIF."
    );
  }

  const provider = await getModuleProvider("mvp-factory");
  const user =
    kind === "logo"
      ? "Esta imagen es el LOGO del negocio. Deduce su identidad visual (paleta, tipografía, tono) a partir de él."
      : "Esta imagen es un brief de diseño / referencia visual aportada por el cliente para este negocio. Deduce de ella la identidad visual (paleta, tipografía, tono) que debería usarse.";

  const { text, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user,
    maxTokens: 1500,
    images: [{ data: base64, mediaType }],
  });

  const parsed = parseIdentityJson(text);
  return {
    source: kind === "logo" ? "logo" : "manual",
    sourceUrl: null,
    colors: parsed.colors,
    fontHeading: parsed.fontHeading,
    fontBody: parsed.fontBody,
    styleNotes: parsed.styleNotes,
    logoImage: kind === "logo" ? base64 : null,
    logoImageMime: kind === "logo" ? mediaType : null,
    referenceImage: kind === "reference" ? base64 : null,
    referenceImageMime: kind === "reference" ? mediaType : null,
    model,
  };
}

// ─── HTML hint extraction ─────────────────────────────────────────────────────

interface HtmlHints {
  themeColor: string | null;
  hexColors: string[];
  fontFamilies: string[];
  logoUrl: string | null;
}

function extractHtmlHints(html: string, baseUrl: string): HtmlHints {
  const themeColorMatch = html.match(
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
  );
  const themeColor = themeColorMatch ? themeColorMatch[1].trim() : null;

  // Hex colors from inline <style> blocks (cap to avoid noise from huge bundles).
  const hexColors: string[] = [];
  const seenHex = new Set<string>();
  for (const styleBlock of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const m of styleBlock[1].matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = m[0].toLowerCase();
      if (!seenHex.has(hex)) {
        seenHex.add(hex);
        hexColors.push(hex);
      }
      if (hexColors.length >= 20) break;
    }
    if (hexColors.length >= 20) break;
  }

  // font-family declarations from inline <style> blocks.
  const fontFamilies: string[] = [];
  const seenFonts = new Set<string>();
  for (const m of html.matchAll(/font-family\s*:\s*([^;"'}]+)/gi)) {
    const name = m[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    const lower = name.toLowerCase();
    if (name && !seenFonts.has(lower) && !["inherit", "initial", "unset"].includes(lower)) {
      seenFonts.add(lower);
      fontFamilies.push(name);
    }
    if (fontFamilies.length >= 8) break;
  }

  const logoUrl = findLogoUrl(html, baseUrl);

  return { themeColor, hexColors, fontFamilies, logoUrl };
}

/** Finds the most likely logo/icon URL, resolved to an absolute URL. */
function findLogoUrl(html: string, baseUrl: string): string | null {
  const candidates: string[] = [];

  // <img> tags whose alt/class/id/src mention "logo".
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/\bsrc=["']([^"']+)["']/i);
    if (src) candidates.push(src[1]);
  }

  // <link rel="apple-touch-icon" | "icon" | "shortcut icon">.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i);
    if (href) candidates.push(href[1]);
  }

  // <meta property="og:image">.
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) candidates.push(og[1]);

  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate, baseUrl);
    if (resolved) return resolved;
  }
  return null;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

// ─── Logo download ────────────────────────────────────────────────────────────

interface DownloadedImage {
  base64: string;
  mediaType: string;
}

/** Downloads the candidate logo image, returning it only if vision-compatible. */
async function tryDownloadLogo(logoUrl: string | null): Promise<DownloadedImage | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetchWithTimeout(logoUrl, { Accept: "image/*" });
    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
    if (!VISION_MEDIA_TYPES.has(contentType)) return null;

    const buffer = await readCappedBuffer(response, MAX_IMAGE_BYTES);
    if (!buffer) return null;

    return { base64: buffer.toString("base64"), mediaType: contentType };
  } catch {
    return null;
  }
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function buildWebsiteUserPrompt(
  url: string,
  hints: HtmlHints,
  logo: DownloadedImage | null
): string {
  const lines: string[] = [`Web del negocio: ${url}`];

  if (logo) {
    lines.push(`Se adjunta el logo/icono detectado en la web (imagen).`);
  } else if (hints.logoUrl) {
    lines.push(`Se detectó un logo en ${hints.logoUrl} pero no se pudo descargar/analizar.`);
  } else {
    lines.push(`No se encontró un logo identificable en la web.`);
  }

  if (hints.themeColor) lines.push(`Color de marca declarado (theme-color): ${hints.themeColor}`);
  if (hints.hexColors.length > 0) {
    lines.push(`Colores hex encontrados en los estilos de la página: ${hints.hexColors.join(", ")}`);
  }
  if (hints.fontFamilies.length > 0) {
    lines.push(`Tipografías declaradas en los estilos de la página: ${hints.fontFamilies.join(", ")}`);
  }

  lines.push(
    ``,
    `Deduce la identidad visual real de este negocio a partir de estas pistas y, si está disponible, del logo adjunto. Devuelve el JSON indicado.`
  );
  return lines.join("\n");
}

// ─── JSON parsing ─────────────────────────────────────────────────────────────

interface ParsedIdentity {
  colors: BrandColor[];
  fontHeading: string | null;
  fontBody: string | null;
  styleNotes: string | null;
}

function parseIdentityJson(text: string): ParsedIdentity {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new BrandIdentityParseError("La IA no devolvió un objeto JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new BrandIdentityParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new BrandIdentityParseError("Respuesta de la IA con formato inesperado.");
  }
  const o = parsed as Record<string, unknown>;

  const colors = toColors(o.colors);
  if (colors.length === 0) {
    throw new BrandIdentityParseError("La IA no produjo una paleta de colores utilizable.");
  }

  return {
    colors,
    fontHeading: typeof o.fontHeading === "string" ? o.fontHeading : null,
    fontBody: typeof o.fontBody === "string" ? o.fontBody : null,
    styleNotes: typeof o.styleNotes === "string" ? o.styleNotes : null,
  };
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function toColors(value: unknown): BrandColor[] {
  if (!Array.isArray(value)) return [];
  const colors: BrandColor[] = [];
  for (const c of value) {
    if (typeof c !== "object" || c === null) continue;
    const r = c as Record<string, unknown>;
    const role = typeof r.role === "string" ? r.role : "";
    const hex = typeof r.hex === "string" ? r.hex : "";
    if (!role || !HEX_RE.test(hex)) continue;
    const label = typeof r.label === "string" ? r.label : undefined;
    colors.push(label ? { role, hex, label } : { role, hex });
  }
  return colors;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

async function fetchWithTimeout(url: string, accept: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
        ...accept,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Reads the body as text with a byte cap. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return text;
}

/** Reads the body as a Buffer with a byte cap, or null if it exceeds the cap. */
async function readCappedBuffer(response: Response, maxBytes: number): Promise<Buffer | null> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.byteLength <= maxBytes ? buf : null;
  }

  const chunks: Uint8Array[] = [];
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
