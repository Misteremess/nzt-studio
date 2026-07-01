// features/mvp-factory/lib/images.ts
// Server-only OpenAI image generation for the MVP Factory.
//
// Turns an MVP spec into a set of high-fidelity website design mockups,
// branded for the specific business. Images are returned as base64 PNGs so the
// UI can show them and offer a download — nothing is persisted. The OpenAI API
// key never leaves the server.
import "server-only";

import OpenAI from "openai";
import type { MvpSpecData } from "@/features/mvp-factory/types";

export const MVP_IMAGE_MODEL = "gpt-image-2";
const MVP_IMAGE_QUALITY = "high" as const;
const MVP_IMAGE_SIZE = "1536x1024" as const;

/** Thrown when OPENAI_API_KEY is not configured. Surfaced to the UI clearly. */
export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY no está configurada en el servidor.");
    this.name = "MissingOpenAIKeyError";
  }
}

/** Thrown when the image API returns no usable image data. */
export class ImageGenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenError";
  }
}

export interface MvpDesignImage {
  id: "hero" | "features" | "detail";
  label: string;
  /** Base64-encoded PNG (no data: prefix). */
  b64: string;
}

let cachedClient: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new MissingOpenAIKeyError();
  cachedClient ??= new OpenAI({ apiKey });
  return cachedClient;
}

// ─── Prompt building ──────────────────────────────────────────────────────────

/** Shared brand/context block injected into every image prompt. */
function brandContext(businessName: string, summary: string | null, spec: MvpSpecData): string {
  const parts = [
    `Negocio: "${businessName}".`,
    summary ? `Contexto del negocio: ${summary}.` : "",
    `Producto a diseñar: ${spec.pitch}`,
    `Solución: ${spec.solution}`,
    `Usuario objetivo: ${spec.targetUser}`,
  ];
  return parts.filter(Boolean).join(" ");
}

const STYLE_DIRECTIVE =
  "Diseño web moderno, limpio y profesional, alta fidelidad, mostrado dentro de un marco de navegador realista. " +
  "Inventa una paleta de marca coherente y un logotipo tipográfico (wordmark) apropiados para este negocio, " +
  "usados de forma consistente. Textos de la interfaz en español, realistas y legibles. " +
  "Tipografía elegante, buen espaciado, jerarquía visual clara. Estética de producto digital actual. " +
  "Sin marcas de agua, sin texto de relleno tipo lorem ipsum.";

interface ImageSpec {
  id: MvpDesignImage["id"];
  label: string;
  prompt: string;
}

function buildImageSpecs(
  businessName: string,
  summary: string | null,
  spec: MvpSpecData
): ImageSpec[] {
  const ctx = brandContext(businessName, summary, spec);
  const features = spec.coreFeatures.slice(0, 4).join("; ");

  return [
    {
      id: "hero",
      label: "Landing (hero)",
      prompt:
        `${ctx} ` +
        `Diseña la SECCIÓN HERO de la página de inicio: barra de navegación con el logotipo del negocio, ` +
        `un titular potente con la propuesta de valor, subtítulo, un botón de llamada a la acción claro ` +
        `y una imagen o ilustración destacada coherente con el sector. ${STYLE_DIRECTIVE}`,
    },
    {
      id: "features",
      label: "Sección de features",
      prompt:
        `${ctx} ` +
        `Diseña una SECCIÓN DE CARACTERÍSTICAS de la web mostrando en tarjetas estas funcionalidades clave: ${features}. ` +
        `Cada tarjeta con un icono, un título corto y una breve descripción. Composición en cuadrícula equilibrada. ` +
        `${STYLE_DIRECTIVE}`,
    },
    {
      id: "detail",
      label: "Página de detalle / contacto",
      prompt:
        `${ctx} ` +
        `Diseña una PÁGINA INTERIOR de detalle o contacto: contenido principal a la izquierda y un formulario ` +
        `o panel de acción a la derecha (p. ej. encargo, reserva, consulta o contacto), con campos realistas ` +
        `y un botón primario. Mantén la misma identidad de marca que la home. ${STYLE_DIRECTIVE}`,
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates branded website design mockups for an MVP spec.
 * Throws MissingOpenAIKeyError / ImageGenError / OpenAI.APIError on failure.
 */
export async function generateMvpDesignImages(
  businessName: string,
  summary: string | null,
  spec: MvpSpecData
): Promise<MvpDesignImage[]> {
  const client = getClient();
  const specs = buildImageSpecs(businessName, summary, spec);

  const results = await Promise.allSettled(
    specs.map(async (s): Promise<MvpDesignImage> => {
      const res = await client.images.generate({
        model: MVP_IMAGE_MODEL,
        prompt: s.prompt,
        size: MVP_IMAGE_SIZE,
        quality: MVP_IMAGE_QUALITY,
        n: 1,
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new ImageGenError("La IA no devolvió ninguna imagen.");
      return { id: s.id, label: s.label, b64 };
    })
  );

  const images = results
    .filter((r): r is PromiseFulfilledResult<MvpDesignImage> => r.status === "fulfilled")
    .map((r) => r.value);

  if (images.length === 0) throw new ImageGenError("No se pudo generar ninguna imagen.");
  return images;
}
