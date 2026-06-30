// features/home/lib/news.ts
// Server-only: daily "sector news" for the Home page, generated via live web
// search and cached once per UTC day in HomeNewsCache.
import "server-only";

import { prisma } from "@/db/prisma";
import { generateText } from "@/lib/ai/provider";
import { getModuleProvider } from "@/lib/ai/settings";
import type { HomeNewsCategory, HomeNewsData, HomeNewsItem } from "@/features/home/types";

const NEWS_CATEGORIES: HomeNewsCategory[] = ["IA", "Pymes", "Herramientas", "Tendencias"];

const SYSTEM_PROMPT = `Eres el analista de tendencias de NZT Studio, un estudio que construye MVPs, agentes de IA y automatizaciones a medida para pequeños y medianos negocios locales (principalmente en España).

Tu tarea: usa la herramienta de búsqueda web para encontrar las noticias MÁS RELEVANTES Y RECIENTES (de hoy o de los últimos días) sobre:
- Inteligencia artificial aplicada a negocios (agentes de IA, automatización, herramientas para pymes).
- Transformación digital de pequeños y medianos negocios locales.
- Nuevas herramientas, frameworks o modelos de IA relevantes para construir software/MVPs.
- Tendencias del sector de agencias/estudios digitales y desarrollo de software a medida.

Reglas:
- Selecciona entre 5 y 7 noticias, priorizando las más recientes y relevantes.
- No inventes noticias ni URLs. Solo incluye noticias que hayas encontrado realmente al buscar.
- Escribe en español.
- Asigna a cada noticia una categoría, una de: "IA", "Pymes", "Herramientas", "Tendencias".
- La primera noticia del array debe ser la más importante/destacada del día.
- Tu respuesta FINAL debe ser EXCLUSIVAMENTE un array JSON válido (sin texto antes ni después, sin fences markdown) con esta forma exacta:
[
  {
    "title": "string — titular de la noticia",
    "summary": "string — resumen en 1-2 frases de por qué es relevante para NZT Studio",
    "url": "string — URL de la fuente",
    "source": "string — nombre del medio/fuente",
    "category": "string — una de: IA, Pymes, Herramientas, Tendencias"
  }
]`;

const USER_PROMPT =
  "Busca y devuelve hoy las noticias más relevantes del sector en el formato JSON indicado.";

/** Thrown when the model output cannot be parsed into a news array. */
export class NewsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsParseError";
  }
}

function parseNewsItems(text: string): HomeNewsItem[] {
  let candidate = text.trim();
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidate = fenced[1].trim();

  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new NewsParseError("La IA no devolvió un array JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new NewsParseError("No se pudo interpretar la respuesta de la IA.");
  }

  if (!Array.isArray(parsed)) {
    throw new NewsParseError("Respuesta de la IA con formato inesperado.");
  }

  return parsed
    .map((item): HomeNewsItem | null => {
      if (typeof item !== "object" || item === null) return null;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      const url = typeof o.url === "string" ? o.url.trim() : "";
      if (!title || !url) return null;
      const category = typeof o.category === "string" ? o.category.trim() : "";
      return {
        title,
        summary: typeof o.summary === "string" ? o.summary.trim() : "",
        url,
        source: typeof o.source === "string" ? o.source.trim() : "",
        category: NEWS_CATEGORIES.includes(category as HomeNewsCategory)
          ? (category as HomeNewsCategory)
          : undefined,
      };
    })
    .filter((item): item is HomeNewsItem => item !== null)
    .slice(0, 8);
}

/** Today's date as "YYYY-MM-DD" (UTC) — the cache key. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function generateDailyNews(): Promise<{ items: HomeNewsItem[]; provider: string; model: string }> {
  const provider = await getModuleProvider("home");
  const { text, model } = await generateText(provider, {
    system: SYSTEM_PROMPT,
    user: USER_PROMPT,
    maxTokens: 4000,
    webSearch: true,
  });
  return { items: parseNewsItems(text), provider, model };
}

/**
 * Returns today's cached news, generating it on first call of the day.
 * On generation failure, falls back to the most recent cached batch (marked
 * stale) or an empty result with `error` set — never throws.
 */
export async function getOrRefreshNews(force = false): Promise<HomeNewsData> {
  const date = todayKey();

  if (!force) {
    const cached = await prisma.homeNewsCache.findUnique({ where: { date } });
    if (cached) {
      return { items: cached.items as unknown as HomeNewsItem[], generatedAt: cached.createdAt.toISOString(), stale: false };
    }
  }

  try {
    const { items, provider, model } = await generateDailyNews();
    const row = await prisma.homeNewsCache.upsert({
      where: { date },
      create: { date, items: items as unknown as object, provider, model },
      update: { items: items as unknown as object, provider, model, createdAt: new Date() },
    });
    return { items, generatedAt: row.createdAt.toISOString(), stale: false };
  } catch (err) {
    const latest = await prisma.homeNewsCache.findFirst({ orderBy: { date: "desc" } });
    const message = err instanceof Error ? err.message : "Error desconocido al generar noticias.";
    if (latest) {
      return {
        items: latest.items as unknown as HomeNewsItem[],
        generatedAt: latest.createdAt.toISOString(),
        stale: true,
        error: message,
      };
    }
    return { items: [], generatedAt: null, stale: false, error: message };
  }
}
