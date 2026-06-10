// features/mvp-factory/lib/html-mockup.ts
// Server-only AI integration for the MVP Factory.
//
// Turns an already-generated MVP spec into a single self-contained HTML
// mockup of the landing page for the proposed MVP — a tangible "wow" preview
// the studio can show the business owner. Routes to whichever provider
// (Anthropic / Gemini) is configured for this module.
import "server-only";

import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { BrandIdentityData, MvpSpecData, MvpSpecInput } from "@/features/mvp-factory/types";

/** Placeholder the model must use for the real business logo; replaced post-generation. */
const BRAND_LOGO_PLACEHOLDER = "__BRAND_LOGO__";

/** Thrown when the model output is not a usable HTML document. */
export class HtmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HtmlParseError";
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

// Stable system prompt — cached across requests (prefix match) to cut cost.
const SYSTEM_PROMPT = `Eres un diseñador/desarrollador frontend senior de un estudio de diseño de primer nivel, especializado en branding y en construir MVPs a medida para pequeños y medianos negocios locales.

Tu tarea: a partir de la especificación de un MVP y de la investigación real sobre el negocio, genera el HTML de una landing page de UNA SOLA PÁGINA que muestre cómo sería ese MVP — debe sentirse diseñada a medida para ESE negocio concreto, no una plantilla genérica de SaaS.

IDENTIDAD VISUAL:
- Si el prompt de usuario incluye una sección "IDENTIDAD DE MARCA PROPORCIONADA", esa es la identidad REAL del negocio: úsala literalmente (colores hex exactos, tipografías exactas, tono descrito). No inventes otra paleta ni otras tipografías. Si falta algún color o rol, derívalo de los proporcionados manteniendo coherencia y el contraste exigido más abajo.
- Si NO se proporciona identidad de marca, deduce una a partir de la investigación y el contexto del negocio: su sector, posicionamiento (premium / económico / artesanal / tecnológico...), personalidad de marca y público objetivo. Define una paleta de color propia y coherente (2-3 colores principales + neutros) que encaje con ese negocio concreto. EVITA por defecto el típico azul/índigo/morado de SaaS genérico — elige tonos que tengan sentido para el sector (ej. cálidos/tierra para gastronomía tradicional, verdes/naturales para wellness o eco, tonos sobrios para servicios profesionales, vivos para negocios juveniles, etc.).
- Elige (o usa la proporcionada) una pareja tipográfica con personalidad, cárgala vía Google Fonts en el <head> (ej. <link> a fonts.googleapis.com) — no uses siempre la fuente por defecto del sistema.
- Si la investigación menciona el nombre real, dirección, teléfono, redes sociales, especialidades, historia o detalles distintivos del negocio, ÚSALOS literalmente en el copy (header, footer, sección "sobre nosotros", contacto) para que se sienta real y personalizado.
- El resultado debe transmitir calidad de estudio de diseño: jerarquía tipográfica clara, espaciados generosos, detalles de marca (icono o monograma simple con CSS/SVG inline si aporta), microcopys cuidados — no un layout plano de bloques iguales.

SISTEMA DE COLOR Y CONTRASTE (obligatorio, define esto SIEMPRE en el <style> antes que nada):
- Define estas variables CSS en :root con valores concretos (de la identidad proporcionada o de tu paleta deducida): --bg, --surface, --text, --text-muted, --accent, --accent-contrast. Si la marca encaja mejor en oscuro, usa valores oscuros para --bg/--surface y claros para --text — pero define los seis siempre.
- --surface (fondo de cards, header, inputs, footer) DEBE ser perceptiblemente distinto de --bg (nunca el mismo color/valor). Refuerza la separación además con un border sutil (--text al ~8-12% de opacidad) o una sombra suave.
- --text-muted debe mantener contraste legible (mínimo ~4.5:1) tanto sobre --bg como sobre --surface — nunca un gris que se funda con el fondo.
- --accent se usa para CTAs y acentos puntuales; --accent-contrast es el color de texto/icono que va ENCIMA de --accent (debe tener contraste alto sobre él).
- Aplica estas variables de forma consistente: ninguna sección debe quedar con texto del mismo color que su fondo, ni cards "invisibles" sobre el fondo de la página.
- Prohibido usar gradientes azul→índigo→violeta genéricos de SaaS, salvo que la identidad proporcionada los incluya explícitamente.

Reglas técnicas:
- Devuelve EXCLUSIVAMENTE un documento HTML completo y autocontenido, empezando por "<!DOCTYPE html>" y terminando en "</html>". Sin texto antes ni después, sin fences markdown.
- Incluye en el <head> esta línea exacta para los estilos: <script src="https://cdn.tailwindcss.com"></script>
- Usa SOLO clases de Tailwind para el layout y estilos base. Puedes añadir un <style> breve en el <head> solo para: importar Google Fonts, definir las variables CSS de la paleta de marca (sección anterior), y pequeños detalles que Tailwind no cubra (ej. gradientes de marca, formas decorativas). Nada de JS adicional salvo lo imprescindible para algún detalle simple (ej. abrir un menú móvil).
- Para imágenes usa URLs de la forma https://picsum.photos/seed/<slug>/<ancho>/<alto> con un slug derivado del nombre del negocio (minúsculas, sin espacios ni acentos), distinto por cada imagen para variedad. Aplícales tratamiento visual coherente con la paleta (ej. overlays de color de marca, bordes/recortes) en vez de dejarlas "en crudo".
- Si el prompt de usuario indica que hay un LOGO REAL disponible, inserta exactamente UNA vez en el header la etiqueta <img src="${BRAND_LOGO_PLACEHOLDER}" alt="Logo" class="h-8 w-auto object-contain" /> (ajusta solo las clases de tamaño si lo necesitas, nunca el src). No uses ese placeholder si no se indica que hay logo disponible — en ese caso usa un icono/monograma SVG o tipográfico como hasta ahora.
- Estructura típica de landing: header con nombre del negocio y navegación, hero con el pitch del MVP y un CTA, sección de features (coreFeatures), sección dirigida al usuario objetivo (targetUser), sección de confianza/social proof breve, footer con datos de contacto reales si los conoces.
- Adapta el contenido y el tono al negocio y a la oportunidad concretos — nada genérico. Usa nombres, sector y lenguaje realistas para ese negocio.
- Diseño moderno, limpio, mobile-first (la landing se verá embebida en un iframe).
- Escribe todos los textos en español.`;

function buildUserPrompt(input: MvpSpecInput, spec: MvpSpecData): string {
  const lines: string[] = [
    `Genera el HTML del mockup de landing page para este MVP. Antes de nada, define la identidad visual (paleta, tipografía, tono) propia de este negocio según las reglas del sistema.`,
    ``,
    `NEGOCIO:`,
    `- Nombre: ${input.businessName}`,
  ];
  if (input.businessSummary) lines.push(`- Contexto: ${input.businessSummary}`);
  if (input.businessAssets.length > 0) {
    lines.push(`- Lo que el negocio ya tiene (presencia/marca detectada):`);
    for (const a of input.businessAssets) lines.push(`  - ${a}`);
  }
  if (input.businessWebFindings) {
    lines.push(
      ``,
      `INVESTIGACIÓN WEB SOBRE EL NEGOCIO (úsala para extraer identidad de marca, datos reales de contacto, especialidades, tono):`,
      input.businessWebFindings
    );
  }
  const brandBlock = buildBrandIdentityBlock(input.brandIdentity);
  if (brandBlock) lines.push(``, ...brandBlock);
  lines.push(
    ``,
    `OPORTUNIDAD:`,
    `- Título: ${input.opportunityTitle}`,
    `- Qué es: ${input.opportunityDescription}`,
    ``,
    `MVP:`,
    `- Pitch: ${spec.pitch}`,
    `- Solución: ${spec.solution}`,
    `- Usuario objetivo: ${spec.targetUser}`
  );
  if (spec.coreFeatures.length > 0) {
    lines.push(`- Features principales:`);
    for (const f of spec.coreFeatures) lines.push(`  - ${f}`);
  }
  lines.push(``, `Devuelve solo el documento HTML completo.`);
  return lines.join("\n");
}

/** Builds the "IDENTIDAD DE MARCA PROPORCIONADA" block, or null if there's nothing to inject. */
function buildBrandIdentityBlock(brand: BrandIdentityData | null | undefined): string[] | null {
  if (!brand) return null;
  const hasColors = brand.colors.length > 0;
  const hasFonts = Boolean(brand.fontHeading || brand.fontBody);
  if (!hasColors && !hasFonts && !brand.styleNotes) return null;

  const lines: string[] = [
    `IDENTIDAD DE MARCA PROPORCIONADA (úsala literalmente, no inventes otra paleta ni tipografías):`,
  ];
  for (const c of brand.colors) {
    lines.push(`- Color "${c.role}": ${c.hex}${c.label ? ` (${c.label})` : ""}`);
  }
  if (brand.fontHeading) lines.push(`- Tipografía de títulos: ${brand.fontHeading} (Google Fonts)`);
  if (brand.fontBody) lines.push(`- Tipografía de cuerpo: ${brand.fontBody} (Google Fonts)`);
  if (brand.styleNotes) lines.push(`- Notas de estilo/tono de marca: ${brand.styleNotes}`);
  if (brand.logoImage) {
    lines.push(`- El negocio tiene un LOGO REAL disponible: úsalo según la regla del placeholder de logo.`);
  }
  return lines;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateHtmlMockupResult {
  html: string;
  raw: unknown;
  /** Concrete model that produced the output (provider-dependent). */
  model: string;
}

/**
 * Generates a self-contained HTML landing page mockup for an MVP spec using
 * the configured provider.
 * Throws MissingApiKeyError / AiApiError / HtmlParseError on failure.
 */
export async function generateMvpHtmlMockup(
  input: MvpSpecInput,
  spec: MvpSpecData
): Promise<GenerateHtmlMockupResult> {
  const provider = await getModuleProvider("mvp-factory");
  const { text, raw, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(input, spec),
    maxTokens: 8000,
    expectJson: false,
  });

  let html = parseHtml(text);
  const logo = input.brandIdentity;
  if (logo?.logoImage && logo.logoImageMime) {
    const dataUri = `data:${logo.logoImageMime};base64,${logo.logoImage}`;
    html = html.split(BRAND_LOGO_PLACEHOLDER).join(dataUri);
  }
  return { html, raw, model };
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function parseHtml(text: string): string {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) candidate = fenced[1].trim();

  if (!/<html[\s>]/i.test(candidate)) {
    throw new HtmlParseError("La IA no devolvió un documento HTML utilizable.");
  }

  return candidate;
}
